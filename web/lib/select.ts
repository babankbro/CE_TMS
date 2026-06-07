import type { Dataset, Meeting, ViewKind } from "./types";

export const VIEW_OPTIONS: { kind: ViewKind; label: string }[] = [
  { kind: "section", label: "กลุ่มเรียน" },
  { kind: "instructor", label: "อาจารย์ผู้สอน" },
  { kind: "room", label: "ห้องเรียน" },
];

/** The selectable entities for a view kind, as {id,label}. */
export function entitiesFor(dataset: Dataset, kind: ViewKind): { id: string; label: string }[] {
  switch (kind) {
    case "section":
      return dataset.sections.map((s) => ({ id: s.id, label: s.code }));
    case "instructor":
      return dataset.instructors.map((i) => ({ id: i.id, label: i.name }));
    case "room":
      return dataset.rooms.map((r) => ({ id: r.id, label: r.name }));
  }
}

/** Meetings for one entity under a view kind. */
export function meetingsFor(dataset: Dataset, kind: ViewKind, entityId: string): Meeting[] {
  switch (kind) {
    case "section":
      return meetingsForSection(dataset, entityId);
    case "instructor":
      return meetingsForInstructor(dataset, entityId);
    case "room":
      return meetingsForRoom(dataset, entityId);
  }
}

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
