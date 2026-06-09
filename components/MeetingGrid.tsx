"use client";

import { useState, useEffect } from "react";
import { assignLanes } from "@/lib/layout";
import { detectConflicts } from "@/lib/conflicts";
import { DAYS, DAY_LABELS_TH, type Dataset, type Day, type Meeting } from "@/lib/types";

// ─── constants ────────────────────────────────────────────────────────────────
const HOUR_START = 8;
const HOUR_END = 22;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const SPAN = HOUR_END - HOUR_START;
const LANE_H = 64;

function pct(h: number) {
  return ((h - HOUR_START) / SPAN) * 100;
}
const newMeetingId = () => `m_${crypto.randomUUID().slice(0, 8)}`;

// ─── meeting type helpers ─────────────────────────────────────────────────────
type MType = "ท" | "ป" | "";

/** Tailwind classes per meeting type (normal / selected / conflict) */
function blockClasses(mtype: MType, selected: boolean, conflict: boolean): string {
  const ring = selected ? "ring-2 ring-offset-0 " : "";
  if (conflict)
    return `${ring}ring-red-400 border-red-300 bg-red-100 text-red-900`;
  if (mtype === "ท")
    return `${ring}ring-sky-400 border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-400 hover:bg-sky-100`;
  if (mtype === "ป")
    return `${ring}ring-emerald-400 border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400 hover:bg-emerald-100`;
  return `${ring}ring-zinc-400 border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100`;
}

// ─── types ────────────────────────────────────────────────────────────────────
type FormMode = "idle" | "add" | "edit";

interface FormState {
  mode: FormMode;
  id: string;
  courseId: string;
  roomId: string;
  day: Day;
  start: number;
  end: number;
  type: MType;
}

const IDLE: FormState = {
  mode: "idle", id: "", courseId: "", roomId: "",
  day: "MON", start: 8, end: 10, type: "",
};

export interface MeetingGridProps {
  draft: Dataset;
  filterSectionId: string | null;
  onAdd: (m: Meeting) => void;
  onUpdate: (id: string, patch: Partial<Meeting>) => void;
  onDelete: (id: string) => void;
}

// ─── component ───────────────────────────────────────────────────────────────
export default function MeetingGrid({
  draft, filterSectionId, onAdd, onUpdate, onDelete,
}: MeetingGridProps) {
  const [form, setForm] = useState<FormState>(IDLE);
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);

  // auto-clear pending message after 6 s
  useEffect(() => {
    if (!pendingMsg) return;
    const t = setTimeout(() => setPendingMsg(null), 6000);
    return () => clearTimeout(t);
  }, [pendingMsg]);

  // ── derived data ─────────────────────────────────────────────────────────────
  const courseById = new Map(draft.courses.map((c) => [c.id, c]));
  const sectionById = new Map(draft.sections.map((s) => [s.id, s]));
  const roomById = new Map(draft.rooms.map((r) => [r.id, r]));

  const filteredCourseIds = filterSectionId
    ? new Set(draft.courses.filter((c) => c.sectionId === filterSectionId).map((c) => c.id))
    : new Set(draft.courses.map((c) => c.id));

  const visibleMeetings = draft.meetings.filter((m) => filteredCourseIds.has(m.courseId));
  const conflictIds = detectConflicts(visibleMeetings, draft, "section");

  // courses shown in the editor dropdown
  const formCourses = filterSectionId
    ? draft.courses.filter((c) => c.sectionId === filterSectionId)
    : draft.courses;

  // ── hours summary per course ──────────────────────────────────────────────────
  interface CourseSummary {
    courseId: string;
    code: string;
    name: string;
    reqT: number; reqP: number;
    schT: number; schP: number;
  }

  const summaryRows: CourseSummary[] = [...filteredCourseIds].map((cid) => {
    const c = courseById.get(cid)!;
    const cms = visibleMeetings.filter((m) => m.courseId === cid);
    return {
      courseId: cid,
      code: c.code,
      name: c.name,
      reqT: c.theoryHours,
      reqP: c.practicalHours,
      schT: cms.filter((m) => (m.type ?? "") === "ท").reduce((s, m) => s + (m.end - m.start), 0),
      schP: cms.filter((m) => (m.type ?? "") === "ป").reduce((s, m) => s + (m.end - m.start), 0),
    };
  }).filter((r) => courseById.has(r.courseId));

  // ── interaction handlers ─────────────────────────────────────────────────────
  function openAddForm(day: Day, hour: number) {
    setPendingMsg(null);
    const firstCourse = formCourses[0];
    setForm({
      mode: "add",
      id: newMeetingId(),
      courseId: firstCourse?.id ?? "",
      roomId: draft.rooms[0]?.id ?? "",
      day,
      start: hour,
      end: Math.min(hour + 2, 22),
      type: "",
    });
  }

  function openEditForm(m: Meeting) {
    setPendingMsg(null);
    setForm({
      mode: "edit",
      id: m.id, courseId: m.courseId, roomId: m.roomId,
      day: m.day, start: m.start, end: m.end,
      type: (m.type ?? "") as MType,
    });
  }

  function patchForm(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function submitAdd() {
    if (!form.courseId) return;
    onAdd({ id: form.id, courseId: form.courseId, roomId: form.roomId, day: form.day, start: form.start, end: form.end, type: form.type });
    setForm(IDLE);
    setPendingMsg("เพิ่มคาบแล้ว — กด บันทึก ที่แถบด้านล่างเพื่อบันทึกลงระบบ");
  }

  function submitEdit() {
    onUpdate(form.id, { courseId: form.courseId, roomId: form.roomId, day: form.day, start: form.start, end: form.end, type: form.type });
    setForm(IDLE);
    setPendingMsg("อัปเดตคาบแล้ว — กด บันทึก ที่แถบด้านล่างเพื่อบันทึกลงระบบ");
  }

  function submitDelete() {
    onDelete(form.id);
    setForm(IDLE);
    setPendingMsg("ลบคาบแล้ว — กด บันทึก ที่แถบด้านล่างเพื่อบันทึกลงระบบ");
  }

  // ── helpers ──────────────────────────────────────────────────────────────────
  const shortRoom = (rid: string) => (roomById.get(rid)?.name ?? "—").split(" ").slice(0, 2).join(" ");
  const sectionCode = (courseId: string) =>
    sectionById.get(courseById.get(courseId)?.sectionId ?? "")?.code ?? "";

  // for the editor: hours already scheduled for selected course
  const selectedCourse = courseById.get(form.courseId);
  const selectedCourseMeetings = visibleMeetings.filter((m) => m.courseId === form.courseId && m.id !== form.id);
  const schT = selectedCourseMeetings.filter((m) => (m.type ?? "") === "ท").reduce((s, m) => s + m.end - m.start, 0)
    + (form.mode !== "idle" && form.type === "ท" ? form.end - form.start : 0);
  const schP = selectedCourseMeetings.filter((m) => (m.type ?? "") === "ป").reduce((s, m) => s + m.end - m.start, 0)
    + (form.mode !== "idle" && form.type === "ป" ? form.end - form.start : 0);

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── course hours summary ── */}
      {summaryRows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">รหัสวิชา</th>
                <th className="px-3 py-2 text-left font-medium">ชื่อวิชา</th>
                <th className="px-3 py-2 text-center font-medium text-sky-700">ท (กำหนด/ต้องการ)</th>
                <th className="px-3 py-2 text-center font-medium text-emerald-700">ป (กำหนด/ต้องการ)</th>
                <th className="px-3 py-2 text-center font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((r) => {
                const tOk = r.reqT === 0 || r.schT >= r.reqT;
                const pOk = r.reqP === 0 || r.schP >= r.reqP;
                const allOk = tOk && pOk;
                return (
                  <tr key={r.courseId} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-3 py-1.5 font-mono text-zinc-600">{r.code}</td>
                    <td className="px-3 py-1.5 text-zinc-800">{r.name}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`font-semibold ${r.schT > 0 ? "text-sky-700" : "text-zinc-400"}`}>{r.schT}</span>
                      <span className="text-zinc-400">/{r.reqT} ชม.</span>
                      {r.reqT > 0 && (
                        <span className="ml-1">{tOk ? "✅" : r.schT > 0 ? "⚠️" : "❌"}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`font-semibold ${r.schP > 0 ? "text-emerald-700" : "text-zinc-400"}`}>{r.schP}</span>
                      <span className="text-zinc-400">/{r.reqP} ชม.</span>
                      {r.reqP > 0 && (
                        <span className="ml-1">{pOk ? "✅" : r.schP > 0 ? "⚠️" : "❌"}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center text-base">
                      {r.reqT === 0 && r.reqP === 0 ? "—" : allOk ? "✅" : "❌"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── timetable grid ── */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="min-w-[820px]">
          {/* legend */}
          <div className="flex items-center gap-4 border-b border-zinc-100 px-3 py-1.5 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded border border-sky-200 bg-sky-50" /> ทฤษฎี (ท)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded border border-emerald-200 bg-emerald-50" /> ปฏิบัติ (ป)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded border border-zinc-200 bg-zinc-50" /> ไม่ระบุ
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded border border-red-300 bg-red-100" /> conflict
            </span>
          </div>

          {/* hour header */}
          <div className="flex border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
            <div className="w-20 shrink-0 px-2 py-1" />
            <div className="relative flex-1">
              <div className="flex">
                {HOURS.map((h) => (
                  <div key={h} className="flex-1 border-l border-zinc-100 px-1 py-1">
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* day rows */}
          {DAYS.map((day) => {
            const dayMeetings = visibleMeetings.filter((m) => m.day === day);
            const { items, laneCount } = assignLanes(dayMeetings);
            const rowHeight = laneCount * LANE_H + 8;
            return (
              <div key={day} className="flex border-b border-zinc-100 last:border-b-0">
                <div className="w-20 shrink-0 px-2 py-2 text-sm font-medium text-zinc-700">
                  {DAY_LABELS_TH[day]}
                </div>
                <div className="relative flex-1" style={{ height: rowHeight }}>
                  {/* gridlines */}
                  <div className="absolute inset-0 flex">
                    {HOURS.map((h) => (
                      <div key={h} className="flex-1 border-l border-zinc-100" />
                    ))}
                  </div>
                  {/* clickable hour slots */}
                  <div className="absolute inset-0 flex" style={{ zIndex: 5 }}>
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        title={`+ คาบ${DAY_LABELS_TH[day]} ${String(h).padStart(2, "0")}:00`}
                        className="flex-1 cursor-pointer transition-colors hover:bg-blue-50/50"
                        onClick={() => openAddForm(day, h)}
                      />
                    ))}
                  </div>
                  {/* meeting blocks */}
                  {items.map(({ meeting, lane }) => {
                    const course = courseById.get(meeting.courseId);
                    const mtype = (meeting.type ?? "") as MType;
                    const conflict = conflictIds.has(meeting.id);
                    const isSelected = form.id === meeting.id;
                    return (
                      <div
                        key={meeting.id}
                        title={`${course?.code ?? ""} ${course?.name ?? ""}\nประเภท: ${mtype || "ไม่ระบุ"}\nห้อง: ${roomById.get(meeting.roomId)?.name ?? "—"}`}
                        onClick={(e) => { e.stopPropagation(); openEditForm(meeting); }}
                        className={`absolute overflow-hidden rounded-md border px-2 py-0.5 text-xs leading-tight cursor-pointer transition-shadow ${blockClasses(mtype, isSelected, conflict)}`}
                        style={{
                          left: `${pct(meeting.start)}%`,
                          width: `${pct(meeting.end) - pct(meeting.start)}%`,
                          top: lane * LANE_H + 4,
                          height: LANE_H - 6,
                          zIndex: 10,
                        }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-medium truncate">{course?.code ?? meeting.courseId}</span>
                          {mtype && (
                            <span className={`shrink-0 rounded px-1 text-[10px] font-bold ${
                              mtype === "ท" ? "bg-sky-200 text-sky-800" : "bg-emerald-200 text-emerald-800"
                            }`}>{mtype}</span>
                          )}
                        </div>
                        <div className="truncate text-[11px] opacity-80">{course?.name}</div>
                        <div className="truncate text-[11px] opacity-70">
                          {sectionCode(meeting.courseId)} · {shortRoom(meeting.roomId)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── pending-save reminder ── */}
      {pendingMsg && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>⚠️</span>
          <span>{pendingMsg}</span>
          <button onClick={() => setPendingMsg(null)} className="ml-auto text-amber-600 hover:text-amber-800">✕</button>
        </div>
      )}

      {/* ── editor panel ── */}
      {form.mode === "idle" ? (
        <p className="text-center text-xs text-zinc-400">
          คลิกช่องว่างในตารางเพื่อเพิ่มคาบสอน · คลิกบล็อกที่มีอยู่เพื่อแก้ไข
        </p>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-700">
              {form.mode === "add" ? "เพิ่มคาบสอน" : "แก้ไขคาบสอน"}
            </span>
            <button onClick={() => setForm(IDLE)} className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100">
              ✕ ยกเลิก
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {/* course */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">รายวิชา</label>
              <select
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm max-w-[22rem]"
                value={form.courseId}
                onChange={(e) => patchForm({ courseId: e.target.value })}
              >
                {form.courseId === "" && <option value="">— เลือกรายวิชา —</option>}
                {formCourses.map((c) => {
                  const sec = sectionById.get(c.sectionId)?.code ?? "";
                  return <option key={c.id} value={c.id}>{sec} · {c.code} · {c.name}</option>;
                })}
              </select>
            </div>

            {/* type ท/ป */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">ประเภทคาบ</label>
              <div className="flex gap-1">
                {(["ท", "ป", ""] as MType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => patchForm({ type: t })}
                    className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                      form.type === t
                        ? t === "ท" ? "border-sky-400 bg-sky-100 text-sky-800"
                          : t === "ป" ? "border-emerald-400 bg-emerald-100 text-emerald-800"
                          : "border-zinc-400 bg-zinc-200 text-zinc-700"
                        : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                    }`}
                  >
                    {t === "" ? "ไม่ระบุ" : t}
                  </button>
                ))}
              </div>
            </div>

            {/* room */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">ห้องเรียน</label>
              <select
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm max-w-[16rem]"
                value={form.roomId}
                onChange={(e) => patchForm({ roomId: e.target.value })}
              >
                <option value="">— ไม่ระบุ —</option>
                {draft.rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* day */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">วัน</label>
              <select
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
                value={form.day}
                onChange={(e) => patchForm({ day: e.target.value as Day })}
              >
                {DAYS.map((d) => <option key={d} value={d}>{DAY_LABELS_TH[d]}</option>)}
              </select>
            </div>

            {/* start / end */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">เริ่ม</label>
              <input
                type="number" min={8} max={21}
                className="w-16 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                value={form.start}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  patchForm({ start: s, end: Math.max(form.end, s + 1) });
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">จบ</label>
              <input
                type="number" min={9} max={22}
                className="w-16 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                value={form.end}
                onChange={(e) => patchForm({ end: Number(e.target.value) })}
              />
            </div>
            <div className="pb-1 text-xs text-zinc-400">
              {form.end > form.start ? `${form.end - form.start} ชม.` : ""}
            </div>

            {/* action buttons */}
            <div className="ml-auto flex gap-2 pb-1">
              {form.mode === "add" ? (
                <button
                  onClick={submitAdd}
                  disabled={!form.courseId}
                  className="rounded-md bg-zinc-800 px-4 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-40"
                >
                  ✓ ยืนยันเพิ่มคาบ
                </button>
              ) : (
                <>
                  <button onClick={submitDelete} className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">ลบ</button>
                  <button onClick={submitEdit} className="rounded-md bg-zinc-800 px-4 py-1.5 text-sm text-white hover:bg-zinc-700">✓ ยืนยัน</button>
                </>
              )}
            </div>
          </div>

          {/* hours progress for selected course */}
          {selectedCourse && (selectedCourse.theoryHours > 0 || selectedCourse.practicalHours > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md bg-zinc-50 px-3 py-2 text-xs">
              <span className="font-medium text-zinc-600">{selectedCourse.code} — ชม.ที่ต้องการ</span>
              {selectedCourse.theoryHours > 0 && (
                <span className={`flex items-center gap-1 ${schT >= selectedCourse.theoryHours ? "text-sky-700" : "text-zinc-500"}`}>
                  <span className="rounded bg-sky-100 px-1 font-bold text-sky-800">ท</span>
                  {schT}/{selectedCourse.theoryHours} ชม.
                  {schT >= selectedCourse.theoryHours ? " ✅" : schT > 0 ? " ⚠️" : " ❌"}
                </span>
              )}
              {selectedCourse.practicalHours > 0 && (
                <span className={`flex items-center gap-1 ${schP >= selectedCourse.practicalHours ? "text-emerald-700" : "text-zinc-500"}`}>
                  <span className="rounded bg-emerald-100 px-1 font-bold text-emerald-800">ป</span>
                  {schP}/{selectedCourse.practicalHours} ชม.
                  {schP >= selectedCourse.practicalHours ? " ✅" : schP > 0 ? " ⚠️" : " ❌"}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
