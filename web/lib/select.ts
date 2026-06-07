import type { Dataset, Meeting } from "./types";

/** Meetings belonging to a Section (via their Course). */
export function meetingsForSection(dataset: Dataset, sectionId: string): Meeting[] {
  const courseIds = new Set(
    dataset.courses.filter((c) => c.sectionId === sectionId).map((c) => c.id),
  );
  return dataset.meetings.filter((m) => courseIds.has(m.courseId));
}

/** Meetings taught by an Instructor (via their Course's instructor list). */
export function meetingsForInstructor(dataset: Dataset, instructorId: string): Meeting[] {
  const courseIds = new Set(
    dataset.courses.filter((c) => c.instructorIds.includes(instructorId)).map((c) => c.id),
  );
  return dataset.meetings.filter((m) => courseIds.has(m.courseId));
}

/** Meetings held in a Room. */
export function meetingsForRoom(dataset: Dataset, roomId: string): Meeting[] {
  return dataset.meetings.filter((m) => m.roomId === roomId);
}
