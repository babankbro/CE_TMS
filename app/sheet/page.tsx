"use client";

import { useEffect, useMemo, useState } from "react";
import type { Course, Dataset, ViewKind } from "@/lib/types";
import { fetchDataset } from "@/lib/api";
import { VIEW_OPTIONS, entitiesFor, meetingsFor } from "@/lib/select";
import { detectConflicts } from "@/lib/conflicts";
import Timetable from "@/components/Timetable";

/** Courses to list in the sheet's top table, depending on the view. */
function sheetCourses(dataset: Dataset, kind: ViewKind, entityId: string): Course[] {
  if (kind === "section") return dataset.courses.filter((c) => c.sectionId === entityId);
  if (kind === "instructor") return dataset.courses.filter((c) => c.instructorIds.includes(entityId));
  const courseIds = new Set(
    dataset.meetings.filter((m) => m.roomId === entityId).map((m) => m.courseId),
  );
  return dataset.courses.filter((c) => courseIds.has(c.id));
}

export default function SheetPage() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<ViewKind>("section");
  const [entityId, setEntityId] = useState<string>("");

  useEffect(() => {
    fetchDataset()
      .then((d) => {
        setDataset(d);
        setEntityId((prev) => prev || d.sections[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, []);

  const entities = useMemo(() => (dataset ? entitiesFor(dataset, kind) : []), [dataset, kind]);
  const entity = entities.find((e) => e.id === entityId);
  const courses = useMemo(
    () => (dataset && entityId ? sheetCourses(dataset, kind, entityId) : []),
    [dataset, kind, entityId],
  );
  const meetings = useMemo(
    () => (dataset && entityId ? meetingsFor(dataset, kind, entityId) : []),
    [dataset, kind, entityId],
  );
  const conflictIds = useMemo(
    () => (dataset ? detectConflicts(meetings, dataset, kind) : new Set<string>()),
    [dataset, meetings, kind],
  );

  function changeKind(next: ViewKind) {
    setKind(next);
    if (dataset) setEntityId(entitiesFor(dataset, next)[0]?.id ?? "");
  }

  if (error) return <p className="text-red-600">เกิดข้อผิดพลาด: {error}</p>;
  if (!dataset || !entity) return <p className="text-zinc-500">กำลังโหลด…</p>;

  const sectionCode = (c: Course) => dataset.sections.find((s) => s.id === c.sectionId)?.code ?? "";
  const roomNames = (courseId: string) => {
    const names = dataset.meetings
      .filter((m) => m.courseId === courseId)
      .map((m) => dataset.rooms.find((r) => r.id === m.roomId)?.name ?? "")
      .filter(Boolean);
    return Array.from(new Set(names)).join(", ");
  };
  const instructorName = (ids: string[]) =>
    ids.map((id) => dataset.instructors.find((i) => i.id === id)?.name ?? "").join(", ");

  const title =
    kind === "section"
      ? `ตารางเรียนสาขาวิชาวิศวกรรมคอมพิวเตอร์ กลุ่มนักศึกษา ${entity.label}`
      : kind === "instructor"
        ? `ตารางสอน อาจารย์ ${entity.label}`
        : `ตารางการใช้ห้อง ${entity.label}`;

  const th = "border border-zinc-300 px-2 py-1";

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold">ใบตาราง</h1>
          <p className="text-sm text-zinc-500">เลือกมุมมองและรายการ แล้วสั่งพิมพ์เพื่อนำไปติดบอร์ด</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-md border border-zinc-300">
            {VIEW_OPTIONS.map((o) => (
              <button
                key={o.kind}
                onClick={() => changeKind(o.kind)}
                className={`px-3 py-1.5 text-sm ${
                  kind === o.kind ? "bg-zinc-800 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="max-w-[18rem] rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
          <button
            onClick={() => {
              const prev = document.title;
              document.title = entity?.label ? `ตารางสอน ${entity.label}` : "ใบตารางสอน";
              window.print();
              document.title = prev;
            }}
            className="rounded-md bg-zinc-800 px-4 py-1.5 text-sm text-white"
          >
            พิมพ์ / บันทึก PDF
          </button>
        </div>
      </div>

      {/* printable sheet */}
      <div className="print-sheet space-y-3 rounded-lg border border-zinc-300 bg-white p-5">
        <div className="text-center">
          <div className="font-semibold">มหาวิทยาลัยกาฬสินธุ์</div>
          <div className="text-sm">{title}</div>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-100 text-left">
              <th className={`${th} w-8`}>ที่</th>
              <th className={th}>รหัสวิชา</th>
              <th className={th}>ชื่อวิชา</th>
              {kind === "section" && <th className={th}>ชื่อห้องเรียน</th>}
              {kind !== "section" && <th className={th}>กลุ่มเรียน</th>}
              {kind === "instructor" && <th className={th}>ห้องเรียน</th>}
              {kind !== "room" && (
                <>
                  <th className={`${th} w-8 text-center`}>ท</th>
                  <th className={`${th} w-8 text-center`}>ป</th>
                  <th className={`${th} w-10 text-center`}>รวม</th>
                </>
              )}
              {kind !== "instructor" && <th className={th}>ผู้สอน</th>}
            </tr>
          </thead>
          <tbody>
            {courses.map((c, idx) => (
              <tr key={c.id}>
                <td className={`${th} text-center`}>{idx + 1}</td>
                <td className={th}>{c.code}</td>
                <td className={th}>{c.name}</td>
                {kind === "section" && <td className={th}>{roomNames(c.id)}</td>}
                {kind !== "section" && <td className={th}>{sectionCode(c)}</td>}
                {kind === "instructor" && <td className={th}>{roomNames(c.id)}</td>}
                {kind !== "room" && (
                  <>
                    <td className={`${th} text-center`}>{c.theoryHours}</td>
                    <td className={`${th} text-center`}>{c.practicalHours}</td>
                    <td className={`${th} text-center`}>{c.theoryHours + c.practicalHours}</td>
                  </>
                )}
                {kind !== "instructor" && <td className={th}>{instructorName(c.instructorIds)}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        <Timetable dataset={dataset} meetings={meetings} conflictIds={conflictIds} viewKind={kind} laneHeight={91} />
      </div>
    </div>
  );
}

