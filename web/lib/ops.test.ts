import { describe, it, expect } from "vitest";
import { diffDataset, applyOps } from "./ops";
import type { Dataset } from "./types";

function base(): Dataset {
  return {
    version: 1,
    sections: [{ id: "s1", code: "CE6541", name: "A", headcount: 20 }],
    courses: [],
    instructors: [{ id: "i1", name: "อ.หนึ่ง" }],
    rooms: [{ id: "r1", name: "ห้อง A", capacity: 35 }],
    meetings: [{ id: "m1", courseId: "c1", roomId: "r1", day: "MON", start: 8, end: 10 }],
  };
}

describe("diffDataset", () => {
  it("returns no ops when nothing changed", () => {
    expect(diffDataset(base(), base())).toEqual([]);
  });

  it("detects an updated field as an upsert", () => {
    const draft = base();
    draft.sections[0].headcount = 30;
    const ops = diffDataset(base(), draft);
    expect(ops).toEqual([{ coll: "sections", kind: "upsert", item: draft.sections[0] }]);
  });

  it("detects an added item", () => {
    const draft = base();
    draft.rooms.push({ id: "r2", name: "ห้อง B", capacity: 40 });
    const ops = diffDataset(base(), draft);
    expect(ops).toContainEqual({ coll: "rooms", kind: "upsert", item: { id: "r2", name: "ห้อง B", capacity: 40 } });
  });

  it("detects a deleted item", () => {
    const draft = base();
    draft.meetings = [];
    expect(diffDataset(base(), draft)).toContainEqual({ coll: "meetings", kind: "delete", id: "m1" });
  });
});

describe("applyOps", () => {
  it("layers an upsert over a different (concurrent) base", () => {
    const server = base();
    server.version = 5;
    server.instructors.push({ id: "i2", name: "อ.สอง" }); // someone else's change
    const myOps = [{ coll: "rooms", kind: "upsert", item: { id: "r1", name: "ห้อง A", capacity: 50 } }] as const;
    const merged = applyOps(server, [...myOps]);
    expect(merged.instructors).toHaveLength(2); // other edit preserved
    expect(merged.rooms.find((r) => r.id === "r1")?.capacity).toBe(50); // my edit applied
  });

  it("applies a delete", () => {
    const merged = applyOps(base(), [{ coll: "meetings", kind: "delete", id: "m1" }]);
    expect(merged.meetings).toHaveLength(0);
  });

  it("does not mutate the input dataset", () => {
    const input = base();
    applyOps(input, [{ coll: "sections", kind: "delete", id: "s1" }]);
    expect(input.sections).toHaveLength(1);
  });
});
