import type { Dataset, Meeting, ViewKind } from "./types";

/** Two meetings overlap when they fall on the same day and their hour ranges intersect. */
export function overlaps(a: Meeting, b: Meeting): boolean {
  return a.day === b.day && a.start < b.end && b.start < a.end;
}

/** The key(s) a meeting belongs to under a given view. Instructor meetings belong to each instructor. */
function keysFor(meeting: Meeting, view: ViewKind): string[] {
  switch (view) {
    case "section":
      return [meeting.sectionId];
    case "room":
      return [meeting.roomId];
    case "instructor":
      return meeting.instructorIds;
  }
}

/**
 * Decide whether an overlapping pair is an allowed exception (NOT a conflict).
 * - instructor: co-teaching the same course (same section) may overlap.
 * - room: a shared room is allowed when the combined headcount of the two sections fits capacity.
 * - section: never an exception.
 */
function isAllowedOverlap(a: Meeting, b: Meeting, dataset: Dataset, view: ViewKind, key: string): boolean {
  if (view === "section") return false;

  if (view === "instructor") {
    return a.sectionId === b.sectionId;
  }

  // room view: combined headcount of the distinct sections must fit the room capacity
  const room = dataset.rooms.find((r) => r.id === key);
  if (!room) return false;
  const headcount = (sectionId: string) =>
    dataset.sections.find((s) => s.id === sectionId)?.headcount ?? 0;
  const combined =
    a.sectionId === b.sectionId
      ? headcount(a.sectionId)
      : headcount(a.sectionId) + headcount(b.sectionId);
  return combined <= room.capacity;
}

/**
 * Return the ids of meetings that conflict under the given view.
 * A conflict is an overlapping pair sharing a view key that is not an allowed exception.
 */
export function detectConflicts(meetings: Meeting[], dataset: Dataset, view: ViewKind): Set<string> {
  const groups = new Map<string, Meeting[]>();
  for (const meeting of meetings) {
    for (const key of keysFor(meeting, view)) {
      const bucket = groups.get(key);
      if (bucket) bucket.push(meeting);
      else groups.set(key, [meeting]);
    }
  }

  const conflicts = new Set<string>();
  for (const [key, bucket] of groups) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];
        if (!overlaps(a, b)) continue;
        if (isAllowedOverlap(a, b, dataset, view, key)) continue;
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  return conflicts;
}
