import { describe, it, expect } from "vitest";
import { assignLanes } from "./layout";
import type { Meeting } from "./types";

const m = (id: string, start: number, end: number): Meeting => ({
  id,
  courseId: "c1",
  roomId: "r1",
  day: "MON",
  start,
  end,
});

function laneOf(items: { meeting: Meeting; lane: number }[], id: string) {
  return items.find((i) => i.meeting.id === id)!.lane;
}

describe("assignLanes", () => {
  it("keeps non-overlapping meetings in a single lane", () => {
    const r = assignLanes([m("a", 8, 10), m("b", 10, 12)]);
    expect(r.laneCount).toBe(1);
    expect(laneOf(r.items, "a")).toBe(0);
    expect(laneOf(r.items, "b")).toBe(0);
  });

  it("puts two overlapping meetings in separate lanes", () => {
    const r = assignLanes([m("a", 8, 12), m("b", 10, 14)]);
    expect(r.laneCount).toBe(2);
    expect(laneOf(r.items, "a")).toBe(0);
    expect(laneOf(r.items, "b")).toBe(1);
  });

  it("uses three lanes for three mutually overlapping meetings", () => {
    const r = assignLanes([m("a", 8, 11), m("b", 9, 12), m("c", 10, 13)]);
    expect(r.laneCount).toBe(3);
  });

  it("reuses a freed lane after an earlier meeting ends", () => {
    // a(8-10) and b(8-11) overlap -> 2 lanes; c(10-12) can reuse a's lane 0
    const r = assignLanes([m("a", 8, 10), m("b", 8, 11), m("c", 10, 12)]);
    expect(r.laneCount).toBe(2);
    expect(laneOf(r.items, "c")).toBe(0);
  });

  it("always reports at least one lane, even when empty", () => {
    expect(assignLanes([]).laneCount).toBe(1);
  });
});
