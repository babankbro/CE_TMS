import { DAYS, type Meeting } from "@/lib/types";
import { assignLanes } from "@/lib/layout";

const HOUR_START = 8;
const HOUR_END = 22;
const SPAN = HOUR_END - HOUR_START;
const LANE_H = 7; // px per lane in the mini view

function pct(hour: number) {
  return ((hour - HOUR_START) / SPAN) * 100;
}

/** A compact, label-less day×hour grid — colored bars only. */
export default function MiniTimetable({
  meetings,
  conflictIds,
}: {
  meetings: Meeting[];
  conflictIds: Set<string>;
}) {
  return (
    <div className="space-y-0.5">
      {DAYS.map((day) => {
        const dayMeetings = meetings.filter((m) => m.day === day);
        const { items, laneCount } = assignLanes(dayMeetings);
        return (
          <div
            key={day}
            className="relative rounded-sm bg-zinc-100"
            style={{ height: laneCount * LANE_H + 2 }}
          >
            {items.map(({ meeting, lane }) => (
              <div
                key={meeting.id}
                className={`absolute rounded-[2px] ${
                  conflictIds.has(meeting.id) ? "bg-red-400" : "bg-sky-400"
                }`}
                style={{
                  left: `${pct(meeting.start)}%`,
                  width: `${Math.max(1, pct(meeting.end) - pct(meeting.start))}%`,
                  top: lane * LANE_H + 1,
                  height: LANE_H - 2,
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
