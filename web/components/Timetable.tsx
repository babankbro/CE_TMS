import { DAYS, DAY_LABELS_TH, type Dataset, type Meeting } from "@/lib/types";
import { assignLanes } from "@/lib/layout";

const HOUR_START = 8;
const HOUR_END = 22; // exclusive upper bound (covers the 21:00–22:00 slot)
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const SPAN = HOUR_END - HOUR_START;
const LANE_H = 52; // px per lane

function pct(hour: number) {
  return ((hour - HOUR_START) / SPAN) * 100;
}

export interface TimetableProps {
  dataset: Dataset;
  meetings: Meeting[];
  conflictIds: Set<string>;
}

export default function Timetable({ dataset, meetings, conflictIds }: TimetableProps) {
  const courseById = new Map(dataset.courses.map((c) => [c.id, c]));
  const roomById = new Map(dataset.rooms.map((r) => [r.id, r]));
  const instructorById = new Map(dataset.instructors.map((i) => [i.id, i]));
  const sectionById = new Map(dataset.sections.map((s) => [s.id, s]));

  const shortRoom = (roomId: string) => (roomById.get(roomId)?.name ?? "").split(" ")[0];
  const sectionCode = (courseId: string) =>
    sectionById.get(courseById.get(courseId)?.sectionId ?? "")?.code ?? "";
  const instructorNames = (courseId: string) =>
    (courseById.get(courseId)?.instructorIds ?? [])
      .map((id) => instructorById.get(id)?.name ?? "")
      .join(", ");

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <div className="min-w-[820px]">
        {/* hour header */}
        <div className="flex border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
          <div className="w-20 shrink-0 px-2 py-1" />
          <div className="relative flex-1">
            <div className="flex">
              {HOURS.map((h) => (
                <div key={h} className="flex-1 border-l border-zinc-100 px-1 py-1">
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* day rows */}
        {DAYS.map((day) => {
          const dayMeetings = meetings.filter((m) => m.day === day);
          const { items, laneCount } = assignLanes(dayMeetings);
          const rowHeight = laneCount * LANE_H + 8;
          return (
            <div key={day} className="flex border-b border-zinc-100 last:border-b-0">
              <div className="w-20 shrink-0 px-2 py-2 text-sm font-medium text-zinc-700">
                {DAY_LABELS_TH[day]}
              </div>
              <div className="relative flex-1" style={{ height: rowHeight }}>
                {/* hour gridlines */}
                <div className="absolute inset-0 flex">
                  {HOURS.map((h) => (
                    <div key={h} className="flex-1 border-l border-zinc-100" />
                  ))}
                </div>
                {/* meeting blocks */}
                {items.map(({ meeting, lane }) => {
                  const course = courseById.get(meeting.courseId);
                  const conflict = conflictIds.has(meeting.id);
                  return (
                    <div
                      key={meeting.id}
                      title={`${course?.code ?? ""} ${course?.name ?? ""}\n${roomById.get(meeting.roomId)?.name ?? ""}\n${instructorNames(meeting.courseId)}`}
                      className={`absolute overflow-hidden rounded-md border px-2 py-1 text-xs leading-tight ${
                        conflict
                          ? "border-red-300 bg-red-100 text-red-900"
                          : "border-sky-200 bg-sky-50 text-sky-900"
                      }`}
                      style={{
                        left: `${pct(meeting.start)}%`,
                        width: `${pct(meeting.end) - pct(meeting.start)}%`,
                        top: lane * LANE_H + 4,
                        height: LANE_H - 6,
                      }}
                    >
                      <div className="font-medium">{course?.code ?? meeting.courseId}</div>
                      <div className="truncate text-[11px] opacity-80">{course?.name}</div>
                      <div className="truncate text-[11px] opacity-70">
                        {sectionCode(meeting.courseId)} · {shortRoom(meeting.roomId)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
