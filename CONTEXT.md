# TMS — Timetable Management System

A system for viewing and editing class timetables for the Computer Engineering department,
as a precursor to an automated scheduling system. The first phase is a viewer/editor over
timetable data extracted from the official schedule PDFs.

## Language

**Section**:
A student-group code, e.g. `CE6541`. The group that students belong to and that owns a Headcount.
One Section takes many Courses; one PDF is one Section's timetable.
_Avoid_: Class, group

**Course**:
A subject offered to a Section, identified by an EN code (e.g. `EN-001-016`). Carries its own name,
Theory/Practical hours, and assigned Instructor(s). The top table of the Schedule Sheet lists a
Section's Courses. The same EN subject taught to two Sections is two Course records.
_Avoid_: Subject, class

**Meeting**:
A single teaching block — one row of the timetable — placing one Course in a Room on exactly one Day
for a start/end time. Section and Instructor(s) are derived from the Course. The unit that is added,
edited, and deleted. A Course meeting on two days is two separate Meetings.
_Avoid_: Slot, class, period

**Day**:
The weekday a Meeting occurs on. The valid range is Monday–Friday (จันทร์–ศุกร์) only; there are no
weekend Meetings. The existing `combined_courses.csv` is missing this field and must be corrected.

**Conflict**:
Two Meetings whose times overlap on the same Day when grouped under the same view key (same Instructor,
same Room, or same Section). Conflicts are highlighted red. Two exceptions are NOT conflicts:
- **Shared Room**: two Sections sharing one Room at overlapping times, where their combined headcount ≤ that Room's capacity.
- **Co-teaching**: instructor time-overlap when the overlapping Meetings are the same subject (same
  Course code) — co-teaching, or one combined class taught to two Sections at once.

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
Two or more Instructors assigned to the same Course (multiple names in one top-table cell, e.g.
"อ.สรายุทธ กรวิรัตน์ ,อ.อัจฉรา ชุมพล"), or one instructor teaching the same subject to two Sections
simultaneously (a combined class). Overlap between Meetings of the same subject (Course code) is not a Conflict.

**Contact Hours (ท+ป)**:
A Course's teaching hours split into Theory (ท) and Practical (ป). Shown in the top course table of
the original schedule sheet and must be retained.

**Schedule Sheet**:
The per-Section printable document that mirrors the original PDF: a top course table (code, name,
Theory/Practical hours, instructor) plus a weekly grid. The app must export this for posting on a board.
