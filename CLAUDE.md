# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TMS is a Thai-language timetable viewer/editor for the Computer Engineering department —
the first phase before an automated scheduling system. It displays the weekly schedule from
three angles (Section / Instructor / Room), highlights conflicts, supports CRUD on all master
data, and prints a per-Section schedule sheet matching the original PDF. Data lives as one JSON
document in Vercel Blob (no database). See [CONTEXT.md](CONTEXT.md) for the domain glossary and
[docs/adr/0001](docs/adr/0001-vercel-blob-as-json-store.md) for the storage decision.

## Layout

- `web/` — the Next.js 16 (App Router) + TypeScript + Tailwind app. **All app commands run here.**
- `seed_json.py` — re-parses `example/*.pdf` (pdfplumber) into `web/data/dataset.seed.json`.
- `example/` — source schedule PDFs + the original (flawed, day-less) `combined_courses.csv`.
- `tasks/` — `plan.md` and `todo.md` (phase-1 task breakdown and status).

## Commands

```bash
# App (run inside web/)
cd web
npm run dev      # dev server
npm run build    # production build (also typechecks)
npm test         # vitest run (all tests)
npx vitest run lib/conflicts.test.ts   # single test file
npx vitest -t "co-teaching"            # tests matching a name

# Regenerate seed data from the PDFs (repo root; needs: pip install pdfplumber)
python seed_json.py
```

The preview/dev server is configured in `.claude/launch.json` (port 3000).

## Architecture

### Data model (`web/lib/types.ts`)
One `Dataset` JSON document: `sections`, `courses`, `instructors`, `rooms`, `meetings`, plus a
numeric `version` for optimistic concurrency. Key relationships:
- **Section** (CE6541) = student group, owns `headcount`.
- **Course** (EN-code) belongs to a Section; carries name, theory/practical hours, and instructor(s).
- **Meeting** = one timetable block: references a `courseId` + `roomId` + one `day` (MON–FRI) +
  integer `start`/`end` hours (8–22). Section and instructors are derived *through the Course*.

### Conflict engine (`web/lib/conflicts.ts`) — the core logic, fully unit-tested
`detectConflicts(meetings, dataset, view)` returns the set of conflicting meeting ids. Overlap =
same day + intersecting hours. Two exceptions are NOT conflicts:
- **Room view**: a shared room is fine when the combined headcount of the two sections ≤ room capacity.
- **Instructor view**: overlap is fine when the meetings are the **same subject (Course code)** —
  co-teaching, or one combined class taught to two sections at once. (Note: keyed on course *code*,
  not the per-section `courseId`.)

### Storage + concurrency (`web/lib/storage.ts`, `dataStore.ts`, `api.ts`, `app/api/data/route.ts`)
- `GET/PUT /api/data` over a pluggable `Storage`: a local JSON file in dev, Vercel Blob when
  `BLOB_READ_WRITE_TOKEN` is set. First read seeds from `dataset.seed.json`.
- **Version guard**: `PUT` rejects (409) if the client `version` ≠ server version, returning the
  current data. The client (`persistDataset`) then re-applies its diff (`lib/ops.ts`
  `diffDataset`/`applyOps`) onto the server's latest and retries — concurrent edits aren't lost.

### UI (`web/app`, `web/components`)
- `/` — timetable view with a Section/Instructor/Room toggle + entity selector; deep-linkable via
  `?view=&id=`. `Timetable.tsx` renders the day×hour grid; `lib/layout.ts` `assignLanes` stacks
  overlapping blocks. `lib/select.ts` holds the view dispatch (`entitiesFor`/`meetingsFor`).
- `/overview` — colored small-multiples (`MiniTimetable.tsx`); tiles deep-link to the detail view.
- `/masters` — tabbed inline CRUD for all entities + a sticky Save bar (diff-based).
- `/sheet` — printable per-Section sheet (course table + grid); `@media print` + `.no-print`.

## Conventions

- UI text is Thai. The viewer/editor is the source of truth at runtime; `combined_courses.csv` is
  legacy and known-flawed (missing the day column) — don't treat it as canonical.
- `web/AGENTS.md` warns that this Next.js major version differs from older docs; check
  `node_modules/next/dist/docs/` before using unfamiliar Next APIs.
- Seed room names are truncated in the source PDFs; `seed_json.py` completes known suffixes and
  prefers the least-wrapped variant. Section headcounts are a temporary uniform 20 (see CP-A note
  in `tasks/todo.md`).
