"""
Seed builder: parse the schedule PDFs in example/ into web/data/dataset.seed.json.

Produces the Dataset shape used by the app (see web/lib/types.ts):
  sections, courses, instructors, rooms, meetings, version.

Course metadata (name, hours, instructors) comes from the clean top table.
Schedule blocks are measured GEOMETRICALLY from the grid cells (cell x-width -> duration),
which captures multi-hour spans reliably; contiguous cells are merged. Instructors come from
the top table; rooms are de-duplicated best-effort. A human reviews web/data/dedup-map.md at CP-A.
"""
import pdfplumber
import glob
import re
import json
import os
from collections import defaultdict

DAYS_TH = {
    "จันทร์": "MON", "อังคาร": "TUE", "พุธ": "WED",
    "พฤหัสบดี": "THU", "ศุกร์": "FRI",
}
INSTRUCTOR_TITLES = r"(?:ผู้ช่วยศาสตราจารย์|รองศาสตราจารย์|ศาสตราจารย์|อาจารย์|ผศ\.|รศ\.|ดร\.|อ\.)"

# Grid geometry calibrated for these PDFs: the 08:00 column starts at x≈69.13px,
# and each one-hour slot is ≈54.14px wide.
GRID_X0 = 69.13
HOUR_PX = 54.14

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, "data")

# Headcount per section (students). Temporary uniform estimate of 20 until real
# numbers are known; edit these or adjust per-section in the app (T8). 0 = unknown.
SECTION_HEADCOUNT = {
    "ce6541": 20, "ce6641": 20, "ce6721": 20,
    "ce6741": 20, "ce6821": 20, "ce6841": 20,
}

# Suffixes the PDF/CSV truncate; completed to their well-known full forms.
TRUNCATION_FIXES = [
    ("ระบบอัตโ", "ระบบอัตโนมัติ"),
    ("เทคโนโลยีอุ", "เทคโนโลยีอุตสาหกรรม"),
]


def norm_ws(s):
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()


def norm_key(s):
    """Aggressive key for de-duplication: drop all whitespace."""
    return re.sub(r"\s+", "", (s or "").replace("\n", "")).strip()


def clean_room(name):
    n = norm_ws(name)
    for cut, full in TRUNCATION_FIXES:
        if n.endswith(cut):
            n = n[: -len(cut)] + full
    return n


def parse_section_code(group):
    return re.sub(r"\s+", "", group or "")  # "CE 6541" -> "CE6541"


def parse_top_table(table):
    """Return list of course dicts from the top course table."""
    courses = []
    for row in table:
        code = row[6] if len(row) > 6 else None
        if not code:
            continue
        code = norm_ws(code)
        if not re.match(r"(EN-[0-9A-Z\-]+|\d{6,})", code):
            continue
        name = norm_ws(row[8]) if len(row) > 8 else ""
        group = norm_ws(row[12]) if len(row) > 12 else ""
        theory = row[17] if len(row) > 17 else None
        practical = row[18] if len(row) > 18 else None
        instr_raw = norm_ws(row[20]) if len(row) > 20 else ""
        instructors = [norm_ws(x) for x in re.split(r"[,/]", instr_raw) if norm_ws(x)]
        courses.append({
            "code": code,
            "name": name,
            "section": parse_section_code(group),
            "theory": int(theory) if str(theory).strip().isdigit() else 0,
            "practical": int(practical) if str(practical).strip().isdigit() else 0,
            "instructors": instructors,
        })
    return courses


def extract_room(cell_text):
    """Room sits between '(CE xxxx)' and the trailing instructor title."""
    t = norm_ws(cell_text)
    after = re.split(r"\([A-Za-z]{1,4}\s*\d{3,}\)", t, maxsplit=1)
    tail = after[1] if len(after) > 1 else t
    tail = re.split(INSTRUCTOR_TITLES, tail, maxsplit=1)[0]
    return norm_ws(tail)


def day_label_tops(page):
    """Y position of each weekday label in the left margin."""
    tops = {}
    for w in page.extract_words():
        t = w["text"].strip()
        if t in DAYS_TH and w["x0"] < 100:
            tops[DAYS_TH[t]] = w["top"]
    return tops


def day_for_top(top, tops):
    current = None
    for day, y in sorted(tops.items(), key=lambda kv: kv[1]):
        if top >= y - 10:
            current = day
    return current


def parse_schedule_geom(page, tops):
    """Measure each schedule cell geometrically: x0 -> start hour, width -> duration."""
    if not tops:
        return []
    first_y = min(tops.values())
    blocks = []
    for cell in page.find_tables()[0].cells:
        x0, top, x1, _bottom = cell
        if x0 <= 65 or top < first_y - 20:
            continue  # skip the day-label column and the top course table
        text = page.crop(cell).extract_text() or ""
        m = re.search(r"\[(EN-[0-9A-Z\-]+|\d{6,})\]", text)
        if not m:
            continue
        start = 8 + round((x0 - GRID_X0) / HOUR_PX)
        duration = max(1, round((x1 - x0) / HOUR_PX))
        start = max(8, start)
        end = min(22, start + duration)
        if end <= start:
            continue
        day = day_for_top(top, tops)
        if day is None:
            continue
        blocks.append({"day": day, "code": norm_ws(m.group(1)), "start": start, "end": end,
                       "room": extract_room(text)})
    return blocks


def merge_intervals(blocks):
    """Merge contiguous/overlapping cells of the same (day, code) into one meeting."""
    by_key = defaultdict(list)
    for b in blocks:
        by_key[(b["day"], b["code"])].append(b)
    out = []
    for items in by_key.values():
        items.sort(key=lambda x: x["start"])
        current = None
        for b in items:
            if current and b["start"] <= current["end"]:
                current["end"] = max(current["end"], b["end"])
                if len(b["room"]) > len(current["room"]):
                    current["room"] = b["room"]
            else:
                if current:
                    out.append(current)
                current = dict(b)
        if current:
            out.append(current)
    return out


def main():
    sections, courses, meetings = {}, {}, []
    instructors, rooms = {}, {}
    room_variants, instr_variants = {}, {}

    def intern(store, variants, prefix, raw, prefer_clean=False):
        key = norm_key(raw)
        if not key:
            return None
        if key not in store:
            ident = f"{prefix}{len(store) + 1}"
            store[key] = {"id": ident, "name": raw}
            variants[ident] = set()
        elif prefer_clean and raw.count(" ") < store[key]["name"].count(" "):
            store[key]["name"] = raw
        variants[store[key]["id"]].add(raw)
        return store[key]["id"]

    for path in sorted(glob.glob(os.path.join(ROOT, "example", "*.pdf"))):
        with pdfplumber.open(path) as pdf:
            page = pdf.pages[0]
            table = page.extract_tables()[0]
            top = parse_top_table(table)
            tops = day_label_tops(page)
            blocks = merge_intervals(parse_schedule_geom(page, tops))

        for c in top:
            sec_code = c["section"] or os.path.basename(path).split("-")[0]
            sec_id = sec_code.lower()
            sections.setdefault(sec_id, {"id": sec_id, "code": sec_code, "name": sec_code,
                                         "headcount": SECTION_HEADCOUNT.get(sec_id, 0)})
            instr_ids = [intern(instructors, instr_variants, "i", n) for n in c["instructors"]]
            instr_ids = [i for i in instr_ids if i]
            course_id = f"{sec_id}__{c['code']}"
            courses[course_id] = {
                "id": course_id, "code": c["code"], "name": c["name"],
                "sectionId": sec_id, "theoryHours": c["theory"],
                "practicalHours": c["practical"], "instructorIds": instr_ids,
            }

        file_section = (top[0]["section"] if top else os.path.basename(path).split("-")[0]).lower()
        for mb in blocks:
            course_id = f"{file_section}__{mb['code']}"
            if course_id not in courses:
                continue
            room_id = intern(rooms, room_variants, "r", mb["room"], prefer_clean=True) if mb["room"] else None
            meetings.append({
                "id": f"m{len(meetings) + 1}", "courseId": course_id,
                "roomId": room_id or "", "day": mb["day"],
                "start": mb["start"], "end": mb["end"],
            })

    dataset = {
        "version": 1,
        "sections": list(sections.values()),
        "courses": list(courses.values()),
        "instructors": [{"id": v["id"], "name": v["name"]} for v in instructors.values()],
        "rooms": [{"id": v["id"], "name": clean_room(v["name"]), "capacity": 35} for v in rooms.values()],
        "meetings": meetings,
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "dataset.seed.json"), "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    lines = ["# De-duplication map (review at CP-A)\n",
             "\nRooms and instructors collapsed from raw PDF strings. Verify variants belong together.\n",
             "\n## Rooms\n"]
    for r in dataset["rooms"]:
        lines.append(f"\n**{r['id']} — {r['name']}** (capacity {r['capacity']})\n")
        for raw in sorted(room_variants[r["id"]]):
            lines.append(f"- `{raw}`\n")
    lines.append("\n## Instructors\n")
    for ins in dataset["instructors"]:
        variants = sorted(instr_variants[ins["id"]])
        extra = "" if len(variants) <= 1 else " ⚠ multiple variants"
        lines.append(f"\n**{ins['id']} — {ins['name']}**{extra}\n")
        for raw in variants:
            lines.append(f"- `{raw}`\n")
    with open(os.path.join(OUT_DIR, "dedup-map.md"), "w", encoding="utf-8") as f:
        f.writelines(lines)

    print(f"sections={len(dataset['sections'])} courses={len(dataset['courses'])} "
          f"instructors={len(dataset['instructors'])} rooms={len(dataset['rooms'])} "
          f"meetings={len(dataset['meetings'])}")


if __name__ == "__main__":
    main()
