import { describe, it, expect } from "vitest";
import { detectConflicts, overlaps } from "./conflicts";
import type { Dataset, Meeting } from "./types";

function makeDataset(meetings: Meeting[], over: Partial<Dataset> = {}): Dataset {
  return {
    version: 1,
    sections: [
      { id: "s1", code: "CE6541", name: "A", theoryHours: 0, practicalHours: 0, headcount: 20 },
      { id: "s2", code: "CE6641", name: "B", theoryHours: 0, practicalHours: 0, headcount: 20 },
      { id: "s3", code: "CE6721", name: "C", theoryHours: 0, practicalHours: 0, headcount: 10 },
    ],
    instructors: [
      { id: "i1", name: "อ.หนึ่ง" },
      { id: "i2", name: "อ.สอง" },
    ],
    rooms: [{ id: "r1", name: "ห้อง A", capacity: 35 }],
    meetings,
    ...over,
  };
}

const m = (p: Partial<Meeting> & { id: string }): Meeting => ({
  sectionId: "s1",
  instructorIds: ["i1"],
  roomId: "r1",
  day: "MON",
  start: 8,
  end: 10,
  ...p,
});

describe("overlaps", () => {
  it("same day overlapping ranges overlap", () => {
    expect(overlaps(m({ id: "a", start: 8, end: 12 }), m({ id: "b", start: 10, end: 14 }))).toBe(true);
  });
  it("adjacent ranges (touching edges) do not overlap", () => {
    expect(overlaps(m({ id: "a", start: 8, end: 10 }), m({ id: "b", start: 10, end: 12 }))).toBe(false);
  });
  it("different days never overlap", () => {
    expect(overlaps(m({ id: "a", day: "MON" }), m({ id: "b", day: "TUE" }))).toBe(false);
  });
});

describe("detectConflicts - section view", () => {
  it("flags overlapping meetings of the same section", () => {
    const meetings = [
      m({ id: "a", sectionId: "s1", start: 8, end: 12 }),
      m({ id: "b", sectionId: "s1", start: 10, end: 14 }),
    ];
    const c = detectConflicts(meetings, makeDataset(meetings), "section");
    expect(c).toEqual(new Set(["a", "b"]));
  });
  it("does not flag adjacent meetings", () => {
    const meetings = [
      m({ id: "a", sectionId: "s1", start: 8, end: 10 }),
      m({ id: "b", sectionId: "s1", start: 10, end: 12 }),
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "section").size).toBe(0);
  });
  it("does not flag overlapping meetings of different sections", () => {
    const meetings = [
      m({ id: "a", sectionId: "s1", start: 8, end: 12 }),
      m({ id: "b", sectionId: "s2", start: 10, end: 14 }),
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "section").size).toBe(0);
  });
});

describe("detectConflicts - instructor view", () => {
  it("flags one instructor double-booked across different sections", () => {
    const meetings = [
      m({ id: "a", instructorIds: ["i1"], sectionId: "s1", start: 8, end: 12 }),
      m({ id: "b", instructorIds: ["i1"], sectionId: "s2", start: 10, end: 14 }),
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "instructor")).toEqual(new Set(["a", "b"]));
  });
  it("does NOT flag co-teaching: same instructor, same section, overlapping", () => {
    const meetings = [
      m({ id: "a", instructorIds: ["i1"], sectionId: "s1", start: 8, end: 12 }),
      m({ id: "b", instructorIds: ["i1"], sectionId: "s1", start: 10, end: 14 }),
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "instructor").size).toBe(0);
  });
});

describe("detectConflicts - room view", () => {
  it("does NOT flag a shared room when combined headcount <= capacity", () => {
    // s1=20 + s3=10 = 30 <= 35
    const meetings = [
      m({ id: "a", sectionId: "s1", roomId: "r1", start: 8, end: 12 }),
      m({ id: "b", sectionId: "s3", roomId: "r1", start: 10, end: 14 }),
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "room").size).toBe(0);
  });
  it("flags a shared room when combined headcount > capacity", () => {
    // s1=20 + s2=20 = 40 > 35
    const meetings = [
      m({ id: "a", sectionId: "s1", roomId: "r1", start: 8, end: 12 }),
      m({ id: "b", sectionId: "s2", roomId: "r1", start: 10, end: 14 }),
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "room")).toEqual(new Set(["a", "b"]));
  });
});
