# TMS — Implementation Plan (Phase 1: Timetable Viewer/Editor)

Derived from [CONTEXT.md](../CONTEXT.md) and [ADR-0001](../docs/adr/0001-vercel-blob-as-json-store.md).

## Goal

A Next.js app, deployed on Vercel, where ~10 scheduling staff view and edit the CE timetable.
Data is one JSON document in Vercel Blob; Save is instantly visible to everyone. Three timetable
views (Section / Instructor / Room), a colored overview, conflict highlighting, master CRUD, and a
printable per-Section Schedule Sheet matching the original PDF.

## Architecture at a glance

```
Browser (React client)
  ├─ in-memory store (loaded dataset + dirty edits)
  ├─ Timetable views (Section / Instructor / Room) + Overview
  ├─ Master CRUD editors
  └─ Schedule Sheet (print/PDF)
        │  GET /api/data            → read JSON blob
        │  PUT /api/data (+version) → write JSON blob (version guard / auto-merge)
        ▼
Next.js API routes ──► Vercel Blob (single dataset.json + version)
```

### Data model (single JSON document)

```ts
Dataset {
  version: number                 // optimistic concurrency
  sections:    Section[]          // { id, code, name, theoryHours, practicalHours, headcount }
  instructors: Instructor[]       // { id, name }
  rooms:       Room[]             // { id, name, capacity }   capacity default 35
  meetings:    Meeting[]          // { id, sectionId, instructorIds[], roomId, day, start, end }
}
day  = MON | TUE | WED | THU | FRI
time = integer hour 8..21
```

`instructorIds` is an array (co-teaching). All references are by id.

### Conflict rule (shared by all three views)

Two meetings overlap in time AND share the view key →
- **Instructor view**: conflict UNLESS the overlapping meetings are the same course taught together (co-teaching).
- **Room view**: conflict UNLESS combined headcount of the overlapping sections ≤ that room's capacity.
- **Section view**: always a conflict on overlap.

Implemented as one pure function `detectConflicts(meetings, dataset, viewKind)` → `Set<meetingId>`.
This is the highest-risk logic; it gets unit tests first.

## Dependency graph

```
T1 seed (CSV→JSON, +day, de-dup) ──┐
T2 Next.js skeleton ───────────────┼──► T4 Blob API (read/write+version)
T3 domain types + conflict engine ─┘            │
        │                                       ▼
        └──────────────► T5 load + Section grid view (vertical slice)
                                 │
                                 ├──► T6 Instructor + Room views (reuse grid)
                                 ├──► T7 Overview (small-multiples, colored)
                                 ├──► T8 Master CRUD + Meeting editor + Save (version guard)
                                 └──► T9 Schedule Sheet print/PDF
```

## Vertical slicing rationale

Each task after the foundation delivers one complete user-visible path (data → API → UI → verify),
not a horizontal layer. T5 is the thinnest end-to-end slice (real blob data rendered as one Section's
grid) and de-risks the whole stack before we fan out into the other views.

## Checkpoints (human review gates)

- **CP-A** after T4 — data foundation: seed JSON is correct (days present, rooms/instructors
  de-duplicated), and the Blob read/write API round-trips. Review the de-dup mapping before building UI on it.
- **CP-B** after T5 — the thin vertical slice renders real data in the browser. Confirm grid axes,
  time range, and block placement look right before replicating across views.
- **CP-C** after T8 — editing + Save works end-to-end with the version guard. Validate conflict
  highlighting and that concurrent saves don't lose work, before polishing the print sheet.

## Out of scope (Phase 1)

Auto-scheduling, per-user auth/login, weekend days, sub-hour (:30) slots, mobile-optimized layout.

## Open inputs needed from the user (non-blocking, flagged in tasks)

- **Headcount source** — currently entered by hand in the app (default 0); import path TBD.
- **Room/Instructor de-dup** — T1 produces a candidate mapping for the user to review at CP-A
  (CSV room names are truncated, e.g. "…ระบบอัตโ").
