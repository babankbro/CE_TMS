import type { Dataset } from "./types";
import { diffDataset, applyOps } from "./ops";

export async function fetchDataset(): Promise<Dataset> {
  const res = await fetch("/api/data", { cache: "no-store" });
  if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
  return (await res.json()) as Dataset;
}

async function put(payload: Dataset): Promise<Response> {
  return fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Save the edited draft. If another editor has saved since we loaded (409),
 * re-apply our changes (diff vs. baseline) onto the server's latest and retry —
 * so neither side's work is lost. Returns the persisted dataset.
 */
export async function persistDataset(baseline: Dataset, draft: Dataset): Promise<Dataset> {
  let res = await put(draft);
  if (res.status === 409) {
    const body = (await res.json()) as { current: Dataset };
    const merged = applyOps(body.current, diffDataset(baseline, draft));
    merged.version = body.current.version;
    res = await put(merged);
  }
  if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
  return (await res.json()) as Dataset;
}
