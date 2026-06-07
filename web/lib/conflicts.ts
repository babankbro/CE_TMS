import type { Course, Dataset, Meeting, ViewKind } from "./types";

/** Two meetings overlap when they fall on the same day and their hour ranges intersect. */
export function overlaps(a: Meeting, b: Meeting): boolean {
  return a.day === b.day && a.start < b.end && b.start < a.end;
}

/** The key(s) a meeting belongs to under a given view. Section/instructors come from the Course. */
function keysFor(meeting: Meeting, course: Course | undefined, view: ViewKind): string[] {
  switch (view) {
    case "section":
      return course ? [course.sectionId] : [];
    case "room":
      return [meeting.roomId];
    case "instructor":
      return course ? course.instructorIds : [];
  }
}

/**
 * Decide whether an overlapping pair is an allowed exception (NOT a conflict).
 * - instructor: Meetings of the same Course may overlap (co-teaching).
 * - room: a shared room is allowed when the combined headcount of the two sections fits capacity.
 * - section: never an exception.
 */
function isAllowedOverlap(
  a: Meeting,
  b: Meeting,
  dataset: Dataset,
  view: ViewKind,
  key: string,
  courseOf: (id: string) => Course | undefined,
): boolean {
  if (view === "section") return false;

  if (view === "instructor") {
    return a.courseId === b.courseId;
  }

  // room view: combined headcount of the distinct sections must fit the room capacity
  const room = dataset.rooms.find((r) => r.id === key);
  if (!room) return false;
  const sectionOf = (m: Meeting) => courseOf(m.courseId)?.sectionId;
  const headcount = (sectionId: string | undefined) =>
    dataset.sections.find((s) => s.id === sectionId)?.headcount ?? 0;
  const sa = sectionOf(a);
  const sb = sectionOf(b);
  const combined = sa === sb ? headcount(sa) : headcount(sa) + headcount(sb);
  return combined <= room.capacity;
}

/**
 * Return the ids of meetings that conflict under the given view.
 * A conflict is an overlapping pair sharing a view key that is not an allowed exception.
 */
export function detectConflicts(meetings: Meeting[], dataset: Dataset, view: ViewKind): Set<string> {
  const courseById = new Map(dataset.courses.map((c) => [c.id, c]));
  const courseOf = (id: string) => courseById.get(id);

  const groups = new Map<string, Meeting[]>();
  for (const meeting of meetings) {
    for (const key of keysFor(meeting, courseOf(meeting.courseId), view)) {
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
        if (isAllowedOverlap(a, b, dataset, view, key, courseOf)) continue;
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  return conflicts;
}
