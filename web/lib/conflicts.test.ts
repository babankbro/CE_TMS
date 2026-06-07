import { describe, it, expect } from "vitest";
import { detectConflicts, overlaps } from "./conflicts";
import type { Dataset, Meeting } from "./types";

// Sections s1,s2 (20 each), s3 (10).
// Courses: c1→s1(i1), c2→s1(i1), c3→s2(i1), c4→s3(i2). c1 is co-taught by i1+i2.
function makeDataset(meetings: Meeting[]): Dataset {
  return {
    version: 1,
    sections: [
      { id: "s1", code: "CE6541", name: "A", headcount: 20 },
      { id: "s2", code: "CE6641", name: "B", headcount: 20 },
      { id: "s3", code: "CE6721", name: "C", headcount: 10 },
    ],
    courses: [
      { id: "c1", code: "EN-1", name: "C1", sectionId: "s1", theoryHours: 0, practicalHours: 0, instructorIds: ["i1", "i2"] },
      { id: "c2", code: "EN-2", name: "C2", sectionId: "s1", theoryHours: 0, practicalHours: 0, instructorIds: ["i1"] },
      { id: "c3", code: "EN-3", name: "C3", sectionId: "s2", theoryHours: 0, practicalHours: 0, instructorIds: ["i1"] },
      { id: "c4", code: "EN-4", name: "C4", sectionId: "s3", theoryHours: 0, practicalHours: 0, instructorIds: ["i2"] },
      // same subject EN-1 offered to a second section (combined-class scenario)
      { id: "c5", code: "EN-1", name: "C1", sectionId: "s2", theoryHours: 0, practicalHours: 0, instructorIds: ["i1"] },
    ],
    instructors: [
      { id: "i1", name: "อ.หนึ่ง" },
      { id: "i2", name: "อ.สอง" },
    ],
    rooms: [{ id: "r1", name: "ห้อง A", capacity: 35 }],
    meetings,
  };
}

const m = (p: Partial<Meeting> & { id: string }): Meeting => ({
  courseId: "c1",
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
  it("flags overlapping meetings of the same section (different courses)", () => {
    const meetings = [
      m({ id: "a", courseId: "c1", start: 8, end: 12 }), // s1
      m({ id: "b", courseId: "c2", start: 10, end: 14 }), // s1
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "section")).toEqual(new Set(["a", "b"]));
  });
  it("does not flag adjacent meetings", () => {
    const meetings = [
      m({ id: "a", courseId: "c1", start: 8, end: 10 }),
      m({ id: "b", courseId: "c2", start: 10, end: 12 }),
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "section").size).toBe(0);
  });
  it("does not flag overlapping meetings of different sections", () => {
    const meetings = [
      m({ id: "a", courseId: "c1", start: 8, end: 12 }), // s1
      m({ id: "b", courseId: "c3", start: 10, end: 14 }), // s2
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "section").size).toBe(0);
  });
});

describe("detectConflicts - instructor view", () => {
  it("flags one instructor double-booked across different courses", () => {
    const meetings = [
      m({ id: "a", courseId: "c2", start: 8, end: 12 }), // i1
      m({ id: "b", courseId: "c3", start: 10, end: 14 }), // i1
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "instructor")).toEqual(new Set(["a", "b"]));
  });
  it("does NOT flag overlapping meetings of the SAME course (co-teaching)", () => {
    const meetings = [
      m({ id: "a", courseId: "c1", start: 8, end: 12 }),
      m({ id: "b", courseId: "c1", start: 10, end: 14 }),
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "instructor").size).toBe(0);
  });
  it("does NOT flag the same SUBJECT taught to two sections at once (combined class)", () => {
    // c1 (EN-1 -> s1) and c5 (EN-1 -> s2), same instructor i1, overlapping
    const meetings = [
      m({ id: "a", courseId: "c1", start: 8, end: 12 }),
      m({ id: "b", courseId: "c5", start: 10, end: 14 }),
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "instructor").size).toBe(0);
  });
});

describe("detectConflicts - room view", () => {
  it("does NOT flag a shared room when combined headcount <= capacity", () => {
    // c1→s1=20, c4→s3=10 → 30 <= 35
    const meetings = [
      m({ id: "a", courseId: "c1", roomId: "r1", start: 8, end: 12 }),
      m({ id: "b", courseId: "c4", roomId: "r1", start: 10, end: 14 }),
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "room").size).toBe(0);
  });
  it("flags a shared room when combined headcount > capacity", () => {
    // c1→s1=20, c3→s2=20 → 40 > 35
    const meetings = [
      m({ id: "a", courseId: "c1", roomId: "r1", start: 8, end: 12 }),
      m({ id: "b", courseId: "c3", roomId: "r1", start: 10, end: 14 }),
    ];
    expect(detectConflicts(meetings, makeDataset(meetings), "room")).toEqual(new Set(["a", "b"]));
  });
});
