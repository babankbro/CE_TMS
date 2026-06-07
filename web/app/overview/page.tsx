"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dataset, ViewKind } from "@/lib/types";
import { fetchDataset } from "@/lib/api";
import { VIEW_OPTIONS, entitiesFor, meetingsFor } from "@/lib/select";
import { detectConflicts } from "@/lib/conflicts";
import MiniTimetable from "@/components/MiniTimetable";

export default function OverviewPage() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<ViewKind>("room");

  useEffect(() => {
    fetchDataset().then(setDataset).catch((e) => setError(e.message));
  }, []);

  const tiles = useMemo(() => {
    if (!dataset) return [];
    return entitiesFor(dataset, kind).map((entity) => {
      const meetings = meetingsFor(dataset, kind, entity.id);
      const conflictIds = detectConflicts(meetings, dataset, kind);
      return { entity, meetings, conflictIds };
    });
  }, [dataset, kind]);

  if (error) return <p className="text-red-600">เกิดข้อผิดพลาด: {error}</p>;
  if (!dataset) return <p className="text-zinc-500">กำลังโหลด…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold">ภาพรวมตาราง</h1>
          <p className="text-sm text-zinc-500">ดูทุกรายการพร้อมกัน · คลิกเพื่อเปิดตารางเต็ม</p>
        </div>
        <div className="ml-auto inline-flex overflow-hidden rounded-md border border-zinc-300">
          {VIEW_OPTIONS.map((o) => (
            <button
              key={o.kind}
              onClick={() => setKind(o.kind)}
              className={`px-3 py-1.5 text-sm ${
                kind === o.kind ? "bg-zinc-800 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(({ entity, meetings, conflictIds }) => (
          <a
            key={entity.id}
            href={`/?view=${kind}&id=${entity.id}`}
            className={`block rounded-lg border bg-white p-3 transition-colors hover:border-zinc-400 ${
              conflictIds.size > 0 ? "border-red-300" : "border-zinc-200"
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium" title={entity.label}>
                {entity.label}
              </span>
              {conflictIds.size > 0 && (
                <span className="shrink-0 rounded bg-red-100 px-1.5 text-xs text-red-700">
                  {conflictIds.size}
                </span>
              )}
            </div>
            <MiniTimetable meetings={meetings} conflictIds={conflictIds} />
          </a>
        ))}
      </div>
    </div>
  );
}
