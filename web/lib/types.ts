// Domain types for the TMS timetable. See ../../CONTEXT.md for definitions.

export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI";

export const DAYS: Day[] = ["MON", "TUE", "WED", "THU", "FRI"];

export const DAY_LABELS_TH: Record<Day, string> = {
  MON: "จันทร์",
  TUE: "อังคาร",
  WED: "พุธ",
  THU: "พฤหัสบดี",
  FRI: "ศุกร์",
};

/** A student-group course offering, e.g. CE6541. */
export interface Section {
  id: string;
  code: string;
  name: string;
  theoryHours: number;
  practicalHours: number;
  headcount: number;
}

export interface Instructor {
  id: string;
  name: string;
}

/** A physical room. capacity defaults to 35 but is editable per room. */
export interface Room {
  id: string;
  name: string;
  capacity: number;
}

/**
 * One teaching block — one row of the timetable. Exactly one day.
 * start/end are integer hours in 8..21. May reference several instructors (co-teaching).
 */
export interface Meeting {
  id: string;
  sectionId: string;
  instructorIds: string[];
  roomId: string;
  day: Day;
  start: number;
  end: number;
}

/** The entire dataset, stored as one JSON document in Vercel Blob. */
export interface Dataset {
  version: number;
  sections: Section[];
  instructors: Instructor[];
  rooms: Room[];
  meetings: Meeting[];
}

export type ViewKind = "section" | "instructor" | "room";
