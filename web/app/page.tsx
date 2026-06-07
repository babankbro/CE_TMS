"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dataset } from "@/lib/types";
import { fetchDataset } from "@/lib/api";
import { meetingsForSection } from "@/lib/select";
import { detectConflicts } from "@/lib/conflicts";
import Timetable from "@/components/Timetable";

export default function SectionViewPage() {
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

  const meetings = useMemo(
    () => (dataset && sectionId ? meetingsForSection(dataset, sectionId) : []),
    [dataset, sectionId],
  );
  const conflictIds = useMemo(
    () => (dataset ? detectConflicts(meetings, dataset, "section") : new Set<string>()),
    [dataset, meetings],
  );

  if (error) return <p className="text-red-600">เกิดข้อผิดพลาด: {error}</p>;
  if (!dataset) return <p className="text-zinc-500">กำลังโหลด…</p>;

  const conflictCount = conflictIds.size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold">ตารางเรียนตามกลุ่มเรียน</h1>
          <p className="text-sm text-zinc-500">เลือกกลุ่มเรียนเพื่อดูตารางทั้งสัปดาห์</p>
        </div>
        <label className="ml-auto text-sm">
          <span className="mr-2 text-zinc-600">กลุ่มเรียน</span>
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5"
          >
            {dataset.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
        </label>
      </div>

      {conflictCount > 0 && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          พบเวลาเรียนทับกัน {conflictCount} คาบ (แสดงด้วยสีแดง)
        </p>
      )}

      <Timetable dataset={dataset} meetings={meetings} conflictIds={conflictIds} />
    </div>
  );
}
