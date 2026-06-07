import { describe, it, expect, beforeEach } from "vitest";
import { getDataset, saveDataset } from "./dataStore";
import type { Storage } from "./storage";
import type { Dataset } from "./types";

function memStorage(initial: Dataset | null = null): Storage & { data: Dataset | null } {
  return {
    data: initial,
    async read() {
      return this.data;
    },
    async write(d: Dataset) {
      this.data = d;
    },
  };
}

const tiny = (version: number): Dataset => ({
  version,
  sections: [],
  courses: [],
  instructors: [],
  rooms: [],
  meetings: [],
});

describe("getDataset", () => {
  it("returns the seed and persists it when storage is empty", async () => {
    const s = memStorage(null);
    const d = await getDataset(s);
    expect(d.version).toBe(1);
    expect(d.meetings.length).toBeGreaterThan(0); // seeded
    expect(s.data).not.toBeNull(); // persisted
  });

  it("returns existing data when present", async () => {
    const s = memStorage(tiny(7));
    const d = await getDataset(s);
    expect(d.version).toBe(7);
    expect(d.meetings.length).toBe(0);
  });
});

describe("saveDataset - version guard", () => {
  let s: Storage & { data: Dataset | null };
  beforeEach(() => {
    s = memStorage(tiny(3));
  });

  it("accepts a save whose version matches and bumps the version", async () => {
    const r = await saveDataset(s, tiny(3));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dataset.version).toBe(4);
    expect(s.data?.version).toBe(4);
  });

  it("rejects a stale save and does not overwrite", async () => {
    const r = await saveDataset(s, tiny(2)); // client behind server (3)
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.current.version).toBe(3);
    expect(s.data?.version).toBe(3); // unchanged
  });

  it("writes seed-as-initial when storage empty, then bumps", async () => {
    const empty = memStorage(null);
    const r = await saveDataset(empty, tiny(1));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dataset.version).toBe(2);
  });
});
