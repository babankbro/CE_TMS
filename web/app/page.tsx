"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dataset, ViewKind } from "@/lib/types";
import { fetchDataset } from "@/lib/api";
import { VIEW_OPTIONS, entitiesFor, meetingsFor } from "@/lib/select";
import { detectConflicts } from "@/lib/conflicts";
import Timetable from "@/components/Timetable";

export default function TimetablePage() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<ViewKind>("section");
  const [entityId, setEntityId] = useState<string>("");

  useEffect(() => {
    fetchDataset()
      .then((d) => {
        setDataset(d);
        const params = new URLSearchParams(window.location.search);
        const urlKind = params.get("view") as ViewKind | null;
        const validKind = VIEW_OPTIONS.some((o) => o.kind === urlKind) ? urlKind! : "section";
        const list = entitiesFor(d, validKind);
        const urlId = params.get("id");
        const initialId = list.some((e) => e.id === urlId) ? urlId! : list[0]?.id ?? "";
        setKind(validKind);
        setEntityId(initialId);
      })
      .catch((e) => setError(e.message));
  }, []);

  // keep the URL in sync so views are shareable / deep-linkable
  useEffect(() => {
    if (!dataset || !entityId) return;
    const params = new URLSearchParams({ view: kind, id: entityId });
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [dataset, kind, entityId]);

  const entities = useMemo(() => (dataset ? entitiesFor(dataset, kind) : []), [dataset, kind]);
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
  if (!dataset) return <p className="text-zinc-500">กำลังโหลด…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold">ตารางเรียนตารางสอน</h1>
          <p className="text-sm text-zinc-500">เลือกมุมมองและรายการเพื่อดูตารางทั้งสัปดาห์</p>
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
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {conflictIds.size > 0 && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          พบเวลาทับกัน {conflictIds.size} คาบ (แสดงด้วยสีแดง)
        </p>
      )}

      <Timetable dataset={dataset} meetings={meetings} conflictIds={conflictIds} />
    </div>
  );
}
