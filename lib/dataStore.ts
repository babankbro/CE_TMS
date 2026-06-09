import type { Storage } from "./storage";
import type { Dataset } from "./types";
import seedJson from "../data/dataset.seed.json";

const seed = seedJson as unknown as Dataset;

/** Read the dataset, seeding storage from the bundled seed on first use. */
export async function getDataset(storage: Storage): Promise<Dataset> {
  const existing = await storage.read();
  if (existing) return existing;
  // Best-effort: persist the seed for next time, but still serve it if the
  // environment has no writable storage (e.g. Vercel without a Blob token).
  try {
    await storage.write(seed);
  } catch {
    // read-only filesystem and no Blob configured — viewing still works
  }
  return seed;
}

/** Overwrite storage with the bundled seed (a forward version bump). Used by Reset. */
export async function resetDataset(storage: Storage): Promise<Dataset> {
  const current = await storage.read();
  const next: Dataset = { ...seed, version: (current?.version ?? 0) + 1 };
  await storage.write(next);
  return next;
}

export type SaveResult =
  | { ok: true; dataset: Dataset }
  | { ok: false; conflict: true; current: Dataset };

/**
 * Optimistic-concurrency save. The incoming dataset carries the version the client
 * loaded; if the server has moved on, reject with the current data so the client can
 * re-fetch and re-apply. On success, persist with an incremented version.
 */
export async function saveDataset(storage: Storage, incoming: Dataset): Promise<SaveResult> {
  const current = await storage.read();
  if (current && incoming.version !== current.version) {
    return { ok: false, conflict: true, current };
  }
  const base = current?.version ?? incoming.version;
  const next: Dataset = { ...incoming, version: base + 1 };
  await storage.write(next);
  return { ok: true, dataset: next };
}
