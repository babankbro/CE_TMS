# TMS — Timetable Management System

A system for viewing and editing class timetables for the Computer Engineering department,
as a precursor to an automated scheduling system. The first phase is a viewer/editor over
timetable data extracted from the official schedule PDFs.

## Language

**Section**:
A student-group code for one course offering, e.g. `CE6541`. The grouping key that students
belong to. One Section contains many Meetings.
_Avoid_: Class, group, course

**Meeting**:
A single teaching block — one row of the timetable — pairing a Section with an instructor, a room,
exactly one Day, and a start/end time. The unit that is added, edited, and deleted. A course taught
on two days is two separate Meetings.
_Avoid_: Slot, class, period

**Day**:
The weekday a Meeting occurs on. The valid range is Monday–Friday (จันทร์–ศุกร์) only; there are no
weekend Meetings. The existing `combined_courses.csv` is missing this field and must be corrected.

**Conflict**:
Two Meetings whose times overlap when grouped under the same view key (same Instructor, same Room,
or same Section). Conflicts are highlighted red. Two exceptions are NOT conflicts:
- **Shared Room**: two Sections sharing one Room at overlapping times, where their combined headcount ≤ that Room's capacity.
- **Co-teaching**: instructor time-overlap when the instructor co-teaches the same course.

**Room**:
A physical teaching space with a name and a capacity (max students). Capacity defaults to 35 but is
editable per Room. Room names in source data are often truncated/messy and must be normalized.

**Instructor**:
A teacher with a stable identity, referenced by Meetings. A Meeting may reference several Instructors
(co-teaching). Names in source data vary in spelling/spacing and must be de-duplicated into one record.

**Headcount**:
The number of students in a Section. Used to decide whether a Shared Room is allowed (combined ≤ Room capacity).
Not present in current source data — must be added per Section.

**Co-teaching**:
Two or more instructors teaching the same course together. In source data this appears as multiple
instructor names in one cell (e.g. "อ.สรายุทธ กรวิรัตน์ ,อ.อัจฉรา ชุมพล"). Co-taught instructor
overlap is not a Conflict.

**Contact Hours (ท+ป)**:
A Section's teaching hours split into Theory (ท) and Practical (ป). Shown in the top course table of
the original schedule sheet and must be retained.

**Schedule Sheet**:
The per-Section printable document that mirrors the original PDF: a top course table (code, name,
Theory/Practical hours, instructor) plus a weekly grid. The app must export this for posting on a board.
