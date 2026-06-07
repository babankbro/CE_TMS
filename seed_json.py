"""
Seed builder: parse the schedule PDFs in example/ into web/data/dataset.seed.json.

Produces the Dataset shape used by the app (see web/lib/types.ts):
  sections, courses, instructors, rooms, meetings, version.

Instructors come from the clean top table; rooms come from the (truncated) grid
cells and are de-duplicated best-effort. A human reviews web/data/dedup-map.md at CP-A.
"""
import pdfplumber
import glob
import re
import json
import os

DAYS = {
    "จันทร์": "MON", "อังคาร": "TUE", "พุธ": "WED",
    "พฤหัสบดี": "THU", "ศุกร์": "FRI",
}
INSTRUCTOR_TITLES = r"(?:ผู้ช่วยศาสตราจารย์|รองศาสตราจารย์|ศาสตราจารย์|อาจารย์|ผศ\.|รศ\.|ดร\.|อ\.)"

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, "web", "data")


def norm_ws(s):
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()


def norm_key(s):
    """Aggressive key for de-duplication: drop all whitespace."""
    return re.sub(r"\s+", "", (s or "").replace("\n", "")).strip()


def parse_section_code(group):
    # "CE 6541" -> "CE6541"
    return re.sub(r"\s+", "", group or "")


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


def build_col_hour_map(table):
    """Find the time-range row and map column index -> start hour."""
    for i, row in enumerate(table):
        if row and row[0] and "วัน" in row[0] and "เวลา" in row[0]:
            time_row = table[i + 1]
            col_hour = {}
            for col, cell in enumerate(time_row):
                if cell:
                    mt = re.match(r"\s*(\d{2}):\d{2}", cell)
                    if mt:
                        col_hour[col] = int(mt.group(1))
            return col_hour
    return {}


def extract_room(cell_text):
    """Room sits between '(CE xxxx)' and the trailing instructor title."""
    t = norm_ws(cell_text)
    after = re.split(r"\([A-Za-z]{1,4}\s*\d{3,}\)", t, maxsplit=1)
    tail = after[1] if len(after) > 1 else t
    tail = re.split(INSTRUCTOR_TITLES, tail, maxsplit=1)[0]
    return norm_ws(tail)


def parse_schedule(table, col_hour):
    """Return list of raw blocks: {day, code, hour, room}."""
    blocks = []
    current_day = None
    for row in table:
        if not row:
            continue
        head = norm_ws(row[0]) if row[0] else ""
        if head in DAYS:
            current_day = DAYS[head]
        if current_day is None:
            continue
        for col, cell in enumerate(row):
            if not cell or col not in col_hour:
                continue
            mcode = re.search(r"\[(EN-[0-9A-Z\-]+|\d{6,})\]", cell)
            if not mcode:
                continue
            blocks.append({
                "day": current_day,
                "code": norm_ws(mcode.group(1)),
                "hour": col_hour[col],
                "room": extract_room(cell),
            })
    return blocks


def merge_runs(blocks):
    """Merge contiguous hour slots of the same (day, code) into meetings."""
    by_key = {}
    for b in blocks:
        by_key.setdefault((b["day"], b["code"]), []).append(b)
    meetings = []
    for (day, code), items in by_key.items():
        items.sort(key=lambda x: x["hour"])
        run_start = run_end = None
        run_room = ""
        for it in items:
            h = it["hour"]
            if run_start is None:
                run_start, run_end, run_room = h, h + 1, it["room"]
            elif h <= run_end:  # contiguous or duplicate (spanned cell)
                run_end = max(run_end, h + 1)
                if len(it["room"]) > len(run_room):
                    run_room = it["room"]
            else:
                meetings.append({"day": day, "code": code, "start": run_start, "end": run_end, "room": run_room})
                run_start, run_end, run_room = h, h + 1, it["room"]
        if run_start is not None:
            meetings.append({"day": day, "code": code, "start": run_start, "end": run_end, "room": run_room})
    return meetings


def main():
    sections, courses, meetings = {}, {}, []
    instructors, rooms = {}, {}   # norm_key -> {id, name}
    room_variants, instr_variants = {}, {}  # id -> set(raw)

    def intern(store, variants, prefix, raw):
        key = norm_key(raw)
        if not key:
            return None
        if key not in store:
            ident = f"{prefix}{len(store) + 1}"
            store[key] = {"id": ident, "name": raw}
            variants[ident] = set()
        variants[store[key]["id"]].add(raw)
        return store[key]["id"]

    for path in sorted(glob.glob(os.path.join(ROOT, "example", "*.pdf"))):
        with pdfplumber.open(path) as pdf:
            table = pdf.pages[0].extract_tables()[0]
        top = parse_top_table(table)
        col_hour = build_col_hour_map(table)
        blocks = parse_schedule(table, col_hour)

        for c in top:
            sec_code = c["section"] or os.path.basename(path).split("-")[0]
            sec_id = sec_code.lower()
            sections.setdefault(sec_id, {"id": sec_id, "code": sec_code, "name": sec_code, "headcount": 0})
            instr_ids = [intern(instructors, instr_variants, "i", n) for n in c["instructors"]]
            instr_ids = [i for i in instr_ids if i]
            course_id = f"{sec_id}__{c['code']}"
            courses[course_id] = {
                "id": course_id, "code": c["code"], "name": c["name"],
                "sectionId": sec_id, "theoryHours": c["theory"],
                "practicalHours": c["practical"], "instructorIds": instr_ids,
            }

        # one section per file (the top table's group)
        file_section = (top[0]["section"] if top else os.path.basename(path).split("-")[0]).lower()
        for mb in merge_runs(blocks):
            course_id = f"{file_section}__{mb['code']}"
            if course_id not in courses:
                continue  # block code not in this file's top table
            room_id = intern(rooms, room_variants, "r", mb["room"]) if mb["room"] else None
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
        "rooms": [{"id": v["id"], "name": v["name"], "capacity": 35} for v in rooms.values()],
        "meetings": meetings,
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "dataset.seed.json"), "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    # dedup map for human review
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
