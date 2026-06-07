"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dataset } from "@/lib/types";
import { fetchDataset } from "@/lib/api";
import { meetingsForSection } from "@/lib/select";
import { detectConflicts } from "@/lib/conflicts";
import Timetable from "@/components/Timetable";

export default function SheetPage() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string>("");

  useEffect(() => {
    fetchDataset()
      .then((d) => {
        setDataset(d);
        setSectionId((prev) => prev || d.sections[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, []);

  const section = dataset?.sections.find((s) => s.id === sectionId);
  const courses = useMemo(
    () => (dataset ? dataset.courses.filter((c) => c.sectionId === sectionId) : []),
    [dataset, sectionId],
  );
  const meetings = useMemo(
    () => (dataset && sectionId ? meetingsForSection(dataset, sectionId) : []),
    [dataset, sectionId],
  );
  const conflictIds = useMemo(
    () => (dataset ? detectConflicts(meetings, dataset, "section") : new Set<string>()),
    [dataset, meetings],
  );

  if (error) return <p className="text-red-600">เกิดข้อผิดพลาด: {error}</p>;
  if (!dataset || !section) return <p className="text-zinc-500">กำลังโหลด…</p>;

  const instructorName = (ids: string[]) =>
    ids.map((id) => dataset.instructors.find((i) => i.id === id)?.name ?? "").join(", ");

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold">ใบตารางเรียน</h1>
          <p className="text-sm text-zinc-500">เลือกกลุ่มเรียนแล้วสั่งพิมพ์เพื่อนำไปติดบอร์ด</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            {dataset.sections.map((s) => (
              <option key={s.id} value={s.id}>{s.code}</option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
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
          <div className="text-sm">
            ตารางเรียนสาขาวิชาวิศวกรรมคอมพิวเตอร์ กลุ่มนักศึกษา {section.code}
          </div>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-100 text-left">
              <th className="border border-zinc-300 px-2 py-1 w-8">ที่</th>
              <th className="border border-zinc-300 px-2 py-1">รหัสวิชา</th>
              <th className="border border-zinc-300 px-2 py-1">ชื่อวิชา</th>
              <th className="border border-zinc-300 px-2 py-1 w-8 text-center">ท</th>
              <th className="border border-zinc-300 px-2 py-1 w-8 text-center">ป</th>
              <th className="border border-zinc-300 px-2 py-1 w-10 text-center">รวม</th>
              <th className="border border-zinc-300 px-2 py-1">ผู้สอน</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c, idx) => (
              <tr key={c.id}>
                <td className="border border-zinc-300 px-2 py-1 text-center">{idx + 1}</td>
                <td className="border border-zinc-300 px-2 py-1">{c.code}</td>
                <td className="border border-zinc-300 px-2 py-1">{c.name}</td>
                <td className="border border-zinc-300 px-2 py-1 text-center">{c.theoryHours}</td>
                <td className="border border-zinc-300 px-2 py-1 text-center">{c.practicalHours}</td>
                <td className="border border-zinc-300 px-2 py-1 text-center">{c.theoryHours + c.practicalHours}</td>
                <td className="border border-zinc-300 px-2 py-1">{instructorName(c.instructorIds)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Timetable dataset={dataset} meetings={meetings} conflictIds={conflictIds} />
      </div>
    </div>
  );
}
