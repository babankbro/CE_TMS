"use client";

import { useState } from "react";
import { assignLanes } from "@/lib/layout";
import { detectConflicts } from "@/lib/conflicts";
import { DAYS, DAY_LABELS_TH, type Dataset, type Day, type Meeting } from "@/lib/types";

// ─── constants (mirror Timetable.tsx) ────────────────────────────────────────
const HOUR_START = 8;
const HOUR_END = 22;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const SPAN = HOUR_END - HOUR_START;
const LANE_H = 52;

function pct(hour: number) {
  return ((hour - HOUR_START) / SPAN) * 100;
}

const newId = () => `m_${crypto.randomUUID().slice(0, 8)}`;

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
}

const IDLE: FormState = {
  mode: "idle",
  id: "",
  courseId: "",
  roomId: "",
  day: "MON",
  start: 8,
  end: 10,
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
  draft,
  filterSectionId,
  onAdd,
  onUpdate,
  onDelete,
}: MeetingGridProps) {
  const [form, setForm] = useState<FormState>(IDLE);

  // ── derived data ────────────────────────────────────────────────────────────
  const courseById = new Map(draft.courses.map((c) => [c.id, c]));
  const sectionById = new Map(draft.sections.map((s) => [s.id, s]));
  const roomById = new Map(draft.rooms.map((r) => [r.id, r]));

  const filteredCourseIds: Set<string> = filterSectionId
    ? new Set(draft.courses.filter((c) => c.sectionId === filterSectionId).map((c) => c.id))
    : new Set(draft.courses.map((c) => c.id));

  const visibleMeetings = draft.meetings.filter((m) => filteredCourseIds.has(m.courseId));

  const conflictIds = detectConflicts(visibleMeetings, draft, "section");

  // courses available in the form dropdown (filtered if section selected)
  const formCourses = filterSectionId
    ? draft.courses.filter((c) => c.sectionId === filterSectionId)
    : draft.courses;

  // ── interaction handlers ───────────────────────────────────────────────────
  function openAddForm(day: Day, hour: number) {
    const firstCourse = formCourses[0];
    setForm({
      mode: "add",
      id: newId(),
      courseId: firstCourse?.id ?? "",
      roomId: draft.rooms[0]?.id ?? "",
      day,
      start: hour,
      end: Math.min(hour + 2, 22),
    });
  }

  function openEditForm(m: Meeting) {
    setForm({ mode: "edit", id: m.id, courseId: m.courseId, roomId: m.roomId, day: m.day, start: m.start, end: m.end });
  }

  function patchForm(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function submitAdd() {
    if (!form.courseId) return;
    onAdd({ id: form.id, courseId: form.courseId, roomId: form.roomId, day: form.day, start: form.start, end: form.end });
    setForm(IDLE);
  }

  function submitEdit() {
    onUpdate(form.id, { courseId: form.courseId, roomId: form.roomId, day: form.day, start: form.start, end: form.end });
    setForm(IDLE);
  }

  function submitDelete() {
    onDelete(form.id);
    setForm(IDLE);
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  const shortRoom = (roomId: string) => (roomById.get(roomId)?.name ?? "—").split(" ").slice(0, 2).join(" ");
  const sectionCode = (courseId: string) =>
    sectionById.get(courseById.get(courseId)?.sectionId ?? "")?.code ?? "";

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* ── timetable grid ── */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="min-w-[820px]">
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
                {/* day label */}
                <div className="w-20 shrink-0 px-2 py-2 text-sm font-medium text-zinc-700">
                  {DAY_LABELS_TH[day]}
                </div>

                {/* content area */}
                <div className="relative flex-1" style={{ height: rowHeight }}>
                  {/* hour gridlines */}
                  <div className="absolute inset-0 flex">
                    {HOURS.map((h) => (
                      <div key={h} className="flex-1 border-l border-zinc-100" />
                    ))}
                  </div>

                  {/* clickable hour slots (behind blocks) */}
                  <div className="absolute inset-0 flex" style={{ zIndex: 5 }}>
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        title={`เพิ่มคาบสอน ${DAY_LABELS_TH[day]} ${String(h).padStart(2, "0")}:00`}
                        className="flex-1 cursor-pointer transition-colors hover:bg-blue-50/50"
                        onClick={() => openAddForm(day, h)}
                      />
                    ))}
                  </div>

                  {/* meeting blocks */}
                  {items.map(({ meeting, lane }) => {
                    const course = courseById.get(meeting.courseId);
                    const conflict = conflictIds.has(meeting.id);
                    const isSelected = form.id === meeting.id;
                    return (
                      <div
                        key={meeting.id}
                        title={`${course?.code ?? ""} ${course?.name ?? ""}\nห้อง ${roomById.get(meeting.roomId)?.name ?? "—"}`}
                        onClick={(e) => { e.stopPropagation(); openEditForm(meeting); }}
                        className={`absolute overflow-hidden rounded-md border px-2 py-1 text-xs leading-tight cursor-pointer transition-shadow ${
                          isSelected
                            ? "ring-2 ring-blue-400 ring-offset-0 " + (conflict ? "border-red-300 bg-red-100 text-red-900" : "border-sky-400 bg-sky-100 text-sky-900")
                            : conflict
                            ? "border-red-300 bg-red-100 text-red-900"
                            : "border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-400 hover:bg-sky-100"
                        }`}
                        style={{
                          left: `${pct(meeting.start)}%`,
                          width: `${pct(meeting.end) - pct(meeting.start)}%`,
                          top: lane * LANE_H + 4,
                          height: LANE_H - 6,
                          zIndex: 10,
                        }}
                      >
                        <div className="font-medium">{course?.code ?? meeting.courseId}</div>
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
            <button
              onClick={() => setForm(IDLE)}
              className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100"
            >
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
                  return (
                    <option key={c.id} value={c.id}>
                      {sec} · {c.code} · {c.name}
                    </option>
                  );
                })}
              </select>
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
                {DAYS.map((d) => (
                  <option key={d} value={d}>{DAY_LABELS_TH[d]}</option>
                ))}
              </select>
            </div>

            {/* start */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">เริ่ม</label>
              <input
                type="number"
                min={8}
                max={21}
                className="w-16 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                value={form.start}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  patchForm({ start: s, end: Math.max(form.end, s + 1) });
                }}
              />
            </div>

            {/* end */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">จบ</label>
              <input
                type="number"
                min={9}
                max={22}
                className="w-16 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                value={form.end}
                onChange={(e) => patchForm({ end: Number(e.target.value) })}
              />
            </div>

            {/* duration badge */}
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
                  + เพิ่มคาบ
                </button>
              ) : (
                <>
                  <button
                    onClick={submitDelete}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    ลบ
                  </button>
                  <button
                    onClick={submitEdit}
                    className="rounded-md bg-zinc-800 px-4 py-1.5 text-sm text-white hover:bg-zinc-700"
                  >
                    บันทึก
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
