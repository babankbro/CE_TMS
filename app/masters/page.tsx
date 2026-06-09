"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Course, Dataset, Day, Instructor, Meeting, Room, Section } from "@/lib/types";
import { DAYS, DAY_LABELS_TH } from "@/lib/types";
import { fetchDataset, persistDataset, replaceDataset, resetDataset } from "@/lib/api";
import { diffDataset } from "@/lib/ops";

// ─── CSV helpers ────────────────────────────────────────────────────────────

function escapeCsv(v: unknown): string {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsvRow(cells: unknown[]): string {
  return cells.map(escapeCsv).join(",");
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cells: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === "," && !inQ) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()]));
  });
}

function triggerDownload(content: string, filename: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob(["﻿" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function datasetToCsv(tab: Tab, d: Dataset): string {
  if (tab === "sections") {
    const rows = [toCsvRow(["id", "code", "name", "headcount"])];
    d.sections.forEach((s) => rows.push(toCsvRow([s.id, s.code, s.name, s.headcount])));
    return rows.join("\n");
  }
  if (tab === "instructors") {
    const rows = [toCsvRow(["id", "name"])];
    d.instructors.forEach((i) => rows.push(toCsvRow([i.id, i.name])));
    return rows.join("\n");
  }
  if (tab === "rooms") {
    const rows = [toCsvRow(["id", "name", "capacity"])];
    d.rooms.forEach((r) => rows.push(toCsvRow([r.id, r.name, r.capacity])));
    return rows.join("\n");
  }
  if (tab === "courses") {
    const rows = [toCsvRow(["id", "code", "name", "sectionId", "theoryHours", "practicalHours", "instructorIds"])];
    d.courses.forEach((c) => rows.push(toCsvRow([c.id, c.code, c.name, c.sectionId, c.theoryHours, c.practicalHours, c.instructorIds.join(";")])));
    return rows.join("\n");
  }
  // meetings
  const rows = [toCsvRow(["id", "courseId", "roomId", "day", "start", "end"])];
  d.meetings.forEach((m) => rows.push(toCsvRow([m.id, m.courseId, m.roomId, m.day, m.start, m.end])));
  return rows.join("\n");
}

function csvToCollection(tab: Tab, rows: Record<string, string>[], draft: Dataset): { ok: true; items: unknown[] } | { ok: false; error: string } {
  try {
    if (tab === "sections") {
      const items: Section[] = rows.map((r, i) => {
        if (!r.code) throw new Error(`แถว ${i + 2}: code ว่าง`);
        return { id: r.id || newId("s"), code: r.code, name: r.name ?? "", headcount: Number(r.headcount) || 0 };
      });
      return { ok: true, items };
    }
    if (tab === "instructors") {
      const items: Instructor[] = rows.map((r, i) => {
        if (!r.name) throw new Error(`แถว ${i + 2}: name ว่าง`);
        return { id: r.id || newId("i"), name: r.name };
      });
      return { ok: true, items };
    }
    if (tab === "rooms") {
      const items: Room[] = rows.map((r, i) => {
        if (!r.name) throw new Error(`แถว ${i + 2}: name ว่าง`);
        return { id: r.id || newId("r"), name: r.name, capacity: Number(r.capacity) || 35 };
      });
      return { ok: true, items };
    }
    if (tab === "courses") {
      const sectionIds = new Set(draft.sections.map((s) => s.id));
      const items: Course[] = rows.map((r, i) => {
        if (!r.code) throw new Error(`แถว ${i + 2}: code ว่าง`);
        if (r.sectionId && !sectionIds.has(r.sectionId)) throw new Error(`แถว ${i + 2}: sectionId "${r.sectionId}" ไม่พบ`);
        const instructorIds = r.instructorIds ? r.instructorIds.split(";").map((x) => x.trim()).filter(Boolean) : [];
        return { id: r.id || newId("c"), code: r.code, name: r.name ?? "", sectionId: r.sectionId ?? draft.sections[0]?.id ?? "", theoryHours: Number(r.theoryHours) || 0, practicalHours: Number(r.practicalHours) || 0, instructorIds };
      });
      return { ok: true, items };
    }
    // meetings
    const courseIds = new Set(draft.courses.map((c) => c.id));
    const roomIds = new Set(draft.rooms.map((r) => r.id));
    const validDays = new Set<string>(DAYS);
    const items: Meeting[] = rows.map((r, i) => {
      if (!r.courseId || !courseIds.has(r.courseId)) throw new Error(`แถว ${i + 2}: courseId "${r.courseId}" ไม่พบ`);
      if (r.roomId && !roomIds.has(r.roomId)) throw new Error(`แถว ${i + 2}: roomId "${r.roomId}" ไม่พบ`);
      if (!validDays.has(r.day)) throw new Error(`แถว ${i + 2}: day "${r.day}" ต้องเป็น MON/TUE/WED/THU/FRI`);
      return { id: r.id || newId("m"), courseId: r.courseId, roomId: r.roomId ?? "", day: r.day as Day, start: Number(r.start) || 8, end: Number(r.end) || 10 };
    });
    return { ok: true, items };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function isValidDataset(o: unknown): o is Dataset {
  if (!o || typeof o !== "object") return false;
  const d = o as Record<string, unknown>;
  return (
    typeof d.version === "number" &&
    (["sections", "courses", "instructors", "rooms", "meetings"] as const).every((k) =>
      Array.isArray(d[k]),
    )
  );
}

type Tab = "meetings" | "courses" | "sections" | "instructors" | "rooms";
const TABS: { id: Tab; label: string }[] = [
  { id: "meetings", label: "คาบสอน" },
  { id: "courses", label: "รายวิชา" },
  { id: "sections", label: "กลุ่มเรียน" },
  { id: "instructors", label: "อาจารย์" },
  { id: "rooms", label: "ห้องเรียน" },
];

// Guards the destructive Reset action against accidental clicks (10 trusted staff;
// this is a deterrent, not real auth — the value ships in the client bundle).
const RESET_PASSWORD = "sarayut";

const newId = (p: string) => `${p}_${crypto.randomUUID().slice(0, 8)}`;
const input = "rounded border border-zinc-300 px-2 py-1 text-sm";
const cell = "border-b border-zinc-100 px-2 py-1 align-top";

export default function MastersPage() {
  const [baseline, setBaseline] = useState<Dataset | null>(null);
  const [draft, setDraft] = useState<Dataset | null>(null);
  const [tab, setTab] = useState<Tab>("meetings");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDataset()
      .then((d) => {
        setBaseline(d);
        setDraft(structuredClone(d));
      })
      .catch((e) => setError(e.message));
  }, []);

  const changeCount = useMemo(
    () => (baseline && draft ? diffDataset(baseline, draft).length : 0),
    [baseline, draft],
  );

  if (error) return <p className="text-red-600">เกิดข้อผิดพลาด: {error}</p>;
  if (!draft || !baseline) return <p className="text-zinc-500">กำลังโหลด…</p>;

  // generic collection helpers
  function update<T extends { id: string }>(coll: keyof Dataset, id: string, patch: Partial<T>) {
    setDraft((d) => {
      if (!d) return d;
      const arr = (d[coll] as unknown as T[]).map((x) => (x.id === id ? { ...x, ...patch } : x));
      return { ...d, [coll]: arr };
    });
  }
  function add(coll: keyof Dataset, item: { id: string }) {
    setDraft((d) => (d ? { ...d, [coll]: [...(d[coll] as unknown as unknown[]), item] } : d));
  }
  function remove(coll: keyof Dataset, id: string) {
    setDraft((d) =>
      d ? { ...d, [coll]: (d[coll] as unknown as { id: string }[]).filter((x) => x.id !== id) } : d,
    );
  }

  function downloadTabCsv() {
    if (!draft) return;
    const date = new Date().toISOString().slice(0, 10);
    triggerDownload(datasetToCsv(tab, draft), `tms-${tab}-${date}.csv`);
  }

  function onImportTabCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !draft) return;
    setNotice(null);
    file.text().then((text) => {
      const rows = parseCsv(text);
      if (rows.length === 0) { setNotice("ไฟล์ CSV ว่างเปล่าหรือรูปแบบไม่ถูกต้อง"); return; }
      const result = csvToCollection(tab, rows, draft);
      if (!result.ok) { setNotice(`CSV error: ${result.error}`); return; }
      const tabLabel = TABS.find((t) => t.id === tab)?.label ?? tab;
      if (!window.confirm(`นำเข้า CSV จะแทนที่ข้อมูลทั้งหมดใน "${tabLabel}" (${result.items.length} แถว) ดำเนินการต่อหรือไม่?`)) return;
      setDraft((d) => d ? { ...d, [tab]: result.items } : d);
      setNotice(`นำเข้า CSV "${tabLabel}" ${result.items.length} แถวแล้ว`);
    });
  }

  function download() {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tms-dataset-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setNotice(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setNotice("ไฟล์ไม่ใช่ JSON ที่ถูกต้อง");
      return;
    }
    if (!isValidDataset(parsed)) {
      setNotice("รูปแบบข้อมูลไม่ถูกต้อง (ต้องมี sections/courses/instructors/rooms/meetings และ version)");
      return;
    }
    if (!window.confirm("นำเข้าไฟล์นี้จะแทนที่ข้อมูลทั้งหมดในระบบ ดำเนินการต่อหรือไม่?")) return;
    setSaving(true);
    try {
      const saved = await replaceDataset(parsed);
      setBaseline(saved);
      setDraft(structuredClone(saved));
      setNotice("นำเข้าข้อมูลแล้ว");
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function passwordOk(): boolean {
    const pw = window.prompt("ใส่รหัสผ่านเพื่อดำเนินการ");
    if (pw === null) return false;
    if (pw !== RESET_PASSWORD) {
      setNotice("รหัสผ่านไม่ถูกต้อง");
      return false;
    }
    return true;
  }

  async function onClear() {
    if (!passwordOk()) return;
    if (!window.confirm("ล้างข้อมูลทั้งหมดให้ว่างเปล่า? (เริ่มสร้างตารางใหม่จากศูนย์)")) return;
    setSaving(true);
    setNotice(null);
    try {
      const empty: Dataset = {
        version: 0,
        sections: [],
        courses: [],
        instructors: [],
        rooms: [],
        meetings: [],
      };
      const saved = await replaceDataset(empty);
      setBaseline(saved);
      setDraft(structuredClone(saved));
      setNotice("ล้างข้อมูลแล้ว");
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    if (!passwordOk()) return;
    if (!window.confirm("รีเซ็ตข้อมูลกลับเป็นค่าตั้งต้น? การแก้ไขทั้งหมดในระบบจะหายไป")) return;
    setSaving(true);
    setNotice(null);
    try {
      const r = await resetDataset();
      setBaseline(r);
      setDraft(structuredClone(r));
      setNotice("รีเซ็ตข้อมูลแล้ว");
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!baseline || !draft) return;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await persistDataset(baseline, draft);
      setBaseline(saved);
      setDraft(structuredClone(saved));
      setNotice("บันทึกแล้ว");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">จัดการข้อมูลหลัก</h1>
          <p className="text-sm text-zinc-500">เพิ่ม ลบ แก้ไข แล้วกดบันทึก</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={download} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50">
            ดาวน์โหลด JSON
          </button>
          <label className="cursor-pointer rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50">
            นำเข้า JSON
            <input type="file" accept="application/json,.json" onChange={onImportFile} className="hidden" />
          </label>
          <button onClick={onReset} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50">
            รีเซ็ตค่าตั้งต้น
          </button>
          <button onClick={onClear} className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
            ล้างข้อมูล
          </button>
        </div>
      </div>

      <div className="flex items-end gap-1 border-b border-zinc-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t.id ? "border-zinc-800 font-medium" : "border-transparent text-zinc-500"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 pb-1">
          <button
            onClick={downloadTabCsv}
            className="flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
            title="ดาวน์โหลด CSV แท็บนี้"
          >
            ↓ CSV
          </button>
          <label
            className="flex cursor-pointer items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
            title="นำเข้า CSV แท็บนี้"
          >
            ↑ CSV
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onImportTabCsv}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {tab === "sections" && (
        <Table headers={["รหัสกลุ่ม", "ชื่อ", "จำนวนนักศึกษา", ""]}>
          {draft.sections.map((s) => (
            <tr key={s.id}>
              <td className={cell}>
                <input className={input} value={s.code} onChange={(e) => update<Section>("sections", s.id, { code: e.target.value })} />
              </td>
              <td className={cell}>
                <input className={input} value={s.name} onChange={(e) => update<Section>("sections", s.id, { name: e.target.value })} />
              </td>
              <td className={cell}>
                <input type="number" className={`${input} w-20`} value={s.headcount} onChange={(e) => update<Section>("sections", s.id, { headcount: Number(e.target.value) })} />
              </td>
              <td className={cell}><DeleteBtn onClick={() => remove("sections", s.id)} /></td>
            </tr>
          ))}
          <AddRow cols={4} onClick={() => add("sections", { id: newId("s"), code: "", name: "", headcount: 0 } as Section)} />
        </Table>
      )}

      {tab === "instructors" && (
        <Table headers={["ชื่ออาจารย์", ""]}>
          {draft.instructors.map((i) => (
            <tr key={i.id}>
              <td className={cell}>
                <input className={`${input} w-full`} value={i.name} onChange={(e) => update<Instructor>("instructors", i.id, { name: e.target.value })} />
              </td>
              <td className={cell}><DeleteBtn onClick={() => remove("instructors", i.id)} /></td>
            </tr>
          ))}
          <AddRow cols={2} onClick={() => add("instructors", { id: newId("i"), name: "" } as Instructor)} />
        </Table>
      )}

      {tab === "rooms" && (
        <Table headers={["ชื่อห้อง", "ความจุ", ""]}>
          {draft.rooms.map((r) => (
            <tr key={r.id}>
              <td className={cell}>
                <input className={`${input} w-full`} value={r.name} onChange={(e) => update<Room>("rooms", r.id, { name: e.target.value })} />
              </td>
              <td className={cell}>
                <input type="number" className={`${input} w-20`} value={r.capacity} onChange={(e) => update<Room>("rooms", r.id, { capacity: Number(e.target.value) })} />
              </td>
              <td className={cell}><DeleteBtn onClick={() => remove("rooms", r.id)} /></td>
            </tr>
          ))}
          <AddRow cols={3} onClick={() => add("rooms", { id: newId("r"), name: "", capacity: 35 } as Room)} />
        </Table>
      )}

      {tab === "courses" && (
        <Table headers={["รหัสวิชา", "ชื่อวิชา", "กลุ่ม", "ท", "ป", "อาจารย์", ""]}>
          {draft.courses.map((c) => (
            <tr key={c.id}>
              <td className={cell}>
                <input className={`${input} w-28`} value={c.code} onChange={(e) => update<Course>("courses", c.id, { code: e.target.value })} />
              </td>
              <td className={cell}>
                <input className={`${input} w-48`} value={c.name} onChange={(e) => update<Course>("courses", c.id, { name: e.target.value })} />
              </td>
              <td className={cell}>
                <select className={input} value={c.sectionId} onChange={(e) => update<Course>("courses", c.id, { sectionId: e.target.value })}>
                  {draft.sections.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
                </select>
              </td>
              <td className={cell}>
                <input type="number" className={`${input} w-12`} value={c.theoryHours} onChange={(e) => update<Course>("courses", c.id, { theoryHours: Number(e.target.value) })} />
              </td>
              <td className={cell}>
                <input type="number" className={`${input} w-12`} value={c.practicalHours} onChange={(e) => update<Course>("courses", c.id, { practicalHours: Number(e.target.value) })} />
              </td>
              <td className={cell}>
                <InstructorPicker
                  instructors={draft.instructors}
                  selected={c.instructorIds}
                  onChange={(ids) => update<Course>("courses", c.id, { instructorIds: ids })}
                />
              </td>
              <td className={cell}><DeleteBtn onClick={() => remove("courses", c.id)} /></td>
            </tr>
          ))}
          <AddRow cols={7} onClick={() => add("courses", { id: newId("c"), code: "", name: "", sectionId: draft.sections[0]?.id ?? "", theoryHours: 0, practicalHours: 0, instructorIds: [] } as Course)} />
        </Table>
      )}

      {tab === "meetings" && (
        <Table headers={["รายวิชา", "ห้อง", "วัน", "เริ่ม", "จบ", ""]}>
          {draft.meetings.map((m) => {
            const course = draft.courses.find((c) => c.id === m.courseId);
            return (
              <tr key={m.id}>
                <td className={cell}>
                  <select className={`${input} max-w-[18rem]`} value={m.courseId} onChange={(e) => update<Meeting>("meetings", m.id, { courseId: e.target.value })}>
                    {draft.courses.map((c) => {
                      const sec = draft.sections.find((s) => s.id === c.sectionId)?.code ?? "";
                      return <option key={c.id} value={c.id}>{sec} · {c.code} · {c.name}</option>;
                    })}
                  </select>
                </td>
                <td className={cell}>
                  <select className={`${input} max-w-[14rem]`} value={m.roomId} onChange={(e) => update<Meeting>("meetings", m.id, { roomId: e.target.value })}>
                    <option value="">—</option>
                    {draft.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td className={cell}>
                  <select className={input} value={m.day} onChange={(e) => update<Meeting>("meetings", m.id, { day: e.target.value as Day })}>
                    {DAYS.map((d) => <option key={d} value={d}>{DAY_LABELS_TH[d]}</option>)}
                  </select>
                </td>
                <td className={cell}>
                  <input type="number" min={8} max={22} className={`${input} w-16`} value={m.start} onChange={(e) => update<Meeting>("meetings", m.id, { start: Number(e.target.value) })} />
                </td>
                <td className={cell}>
                  <input type="number" min={8} max={22} className={`${input} w-16`} value={m.end} onChange={(e) => update<Meeting>("meetings", m.id, { end: Number(e.target.value) })} />
                </td>
                <td className={cell}><DeleteBtn onClick={() => remove("meetings", m.id)} /></td>
              </tr>
            );
          })}
          <AddRow cols={6} onClick={() => add("meetings", { id: newId("m"), courseId: draft.courses[0]?.id ?? "", roomId: draft.rooms[0]?.id ?? "", day: "MON", start: 8, end: 10 } as Meeting)} />
        </Table>
      )}

      {/* sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <span className="text-sm text-zinc-600">
            {changeCount > 0 ? `แก้ไข ${changeCount} รายการ` : "ยังไม่มีการแก้ไข"}
          </span>
          {notice && <span className="text-sm text-emerald-600">{notice}</span>}
          <button
            onClick={save}
            disabled={saving || changeCount === 0}
            className="ml-auto rounded-md bg-zinc-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
          <tr>{headers.map((h, i) => <th key={i} className="px-2 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">
      ลบ
    </button>
  );
}

function AddRow({ cols, onClick }: { cols: number; onClick: () => void }) {
  return (
    <tr>
      <td colSpan={cols} className="px-2 py-2">
        <button onClick={onClick} className="rounded border border-dashed border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
          + เพิ่มรายการ
        </button>
      </td>
    </tr>
  );
}

interface InstructorPickerProps {
  instructors: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

function InstructorPicker({ instructors, selected, onChange }: InstructorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const label = selected.length === 0
    ? "— เลือกอาจารย์"
    : instructors.filter((i) => selected.includes(i.id)).map((i) => i.name).join(", ");

  return (
    <div ref={ref} className="relative w-52">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded border border-zinc-300 bg-white px-2 py-1 text-left text-sm"
      >
        <span className="truncate text-xs">{label}</span>
        <span className="ml-1 text-zinc-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-52 w-full overflow-y-auto rounded border border-zinc-200 bg-white shadow-lg">
          {instructors.length === 0 && (
            <p className="px-3 py-2 text-xs text-zinc-400">ไม่มีอาจารย์</p>
          )}
          {instructors.map((i) => (
            <label key={i.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={selected.includes(i.id)}
                onChange={() => toggle(i.id)}
                className="accent-zinc-800"
              />
              <span className="text-xs">{i.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
