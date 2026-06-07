import type { Meeting } from "./types";

export interface LaidOutMeeting {
  meeting: Meeting;
  lane: number;
}

export interface DayLayout {
  items: LaidOutMeeting[];
  laneCount: number;
}

/**
 * Assign overlapping meetings (assumed same day) to vertical lanes so none visually
 * collide. Greedy: sort by start, place each meeting in the first lane whose previous
 * meeting has already ended.
 */
export function assignLanes(meetings: Meeting[]): DayLayout {
  const sorted = [...meetings].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const items: LaidOutMeeting[] = [];

  for (const meeting of sorted) {
    let lane = laneEnds.findIndex((end) => end <= meeting.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(meeting.end);
    } else {
      laneEnds[lane] = meeting.end;
    }
    items.push({ meeting, lane });
  }

  return { items, laneCount: Math.max(1, laneEnds.length) };
}
