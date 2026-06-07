import type { Dataset } from "./types";

export async function fetchDataset(): Promise<Dataset> {
  const res = await fetch("/api/data", { cache: "no-store" });
  if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
  return (await res.json()) as Dataset;
}
