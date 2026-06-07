# TMS — Task List (Phase 1)

Status: `[ ]` todo · `[~]` in progress · `[x]` done
Order follows the dependency graph in [plan.md](plan.md). Checkpoints are human-review gates.

---

## T1 — Seed: PDF → JSON with days + de-duplication  ✅
- [x] `seed_json.py` re-parses PDFs and emits `day` (MON–FRI) per meeting
- [x] Master lists: de-duplicated Rooms (truncated variants collapsed by whitespace-stripped key) and Instructors (from clean top table)
- [x] Combined instructor cells ("A ,B") split into multiple `instructorIds` (2 co-taught courses)
- [x] `web/data/dataset.seed.json` (6 sections, 35 courses, 12 instructors, 10 rooms, 52 meetings); headcount 0, capacity 35, version 1
- [x] `web/data/dedup-map.md` for human review
- [ ] **CP-A review:** room names are truncated in source (e.g. "…ระบบอัตโ"); confirm/rename at checkpoint. Headcounts default 0.

**Acceptance:** ✅ JSON parses; 0 ref/day/time errors; no duplicate rooms/instructors; co-taught cells → multiple instructorIds.
**Verify:** integrity script — all refs resolve, all days MON–FRI, all times 8–22.

## T2 — Next.js skeleton  ✅
- [x] `create-next-app` (App Router, TypeScript, Tailwind) in `web/`, Thai-default UI, deploys to Vercel
- [x] Base layout + nav placeholder (ตาราง / ภาพรวม / ข้อมูลหลัก / ใบตารางสอน)

**Acceptance:** `npm run dev` serves a Thai shell page; `npm run build` passes.
**Verify:** local dev render + clean build.

## T3 — Domain types + conflict engine (TDD)  ✅
- [x] `lib/types.ts` — Dataset, Section, Instructor, Room, Meeting, Day
- [x] `lib/conflicts.ts` — `detectConflicts(meetings, dataset, viewKind)` pure function
- [x] Unit tests (10) covering: plain overlap; adjacency; cross-day; shared-room within/over capacity; co-teaching overlap; instructor double-book

**Acceptance:** all conflict unit tests pass, including both exceptions.
**Verify:** `npm test`.

## T4 — Blob data API (read / write + version guard)  ✅  → **CP-A**
- [x] `GET /api/data` reads dataset (seeds from `dataset.seed.json` if absent)
- [x] `PUT /api/data` writes; rejects mismatched `version` with 409 + current data; bumps version on success
- [x] Pluggable storage: local-file backend for dev, Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set
- [x] dataStore version-guard unit tests (in-memory storage); 5 tests

**Acceptance:** ✅ GET → seeded v1 (52 meetings); PUT current → 200 bump to v2; PUT stale → 409 with current; re-GET → persisted v2.
**Verify:** ✅ live server round-trip (curl) + unit tests.
**🛑 CHECKPOINT A:** review seed correctness + de-dup map + API round-trip before UI.

## T5 — Load + Section grid view (thin vertical slice)  ✅  → **CP-B**
- [x] Client loads dataset from `/api/data` (`lib/api.ts`)
- [x] `components/Timetable.tsx`: rows = Day (จ–ศ), cols = 08:00–21:00 hourly; blocks placed by start/end with lane stacking for overlaps
- [x] `lib/layout.ts` lane assignment (5 unit tests); `lib/select.ts` meeting selectors
- [x] Section view page with section selector; conflicts rendered red; conflict count banner

**Acceptance:** ✅ selecting CE6541 places its meetings correctly (verified via screenshot vs seed: MON 9–11 EN-001-016, MON 13–14 EN-012-314, WED 9–10 EN-013-336, FRI 8–9 & 10–11 EN-013-338). No section has internal overlaps in real data (correct), so red is exercised in Room view at T6.
**Verify:** ✅ browser screenshot + 20 unit tests + build.
**🛑 CHECKPOINT B:** confirm axes/time-range/placement before replicating.

## T6 — Instructor + Room views
- [ ] Reuse grid; add "View by Instructor" and "View by Room" with selectors
- [ ] Wire view-specific conflict rules (co-teaching exception for instructor; capacity exception for room)

**Acceptance:** instructor view groups that instructor's meetings (co-taught overlaps not red); room view groups by room (within-capacity shared rooms not red, over-capacity red).
**Verify:** craft a co-teaching case and an over-capacity case; confirm coloring.

## T7 — Overview (colored small-multiples)
- [ ] Zoomed-out grid: render a mini timetable per entity for all sections / all rooms / all instructors (separate tiles), color-coded
- [ ] Click a tile → opens that entity in the detailed view (T5/T6)

**Acceptance:** overview shows every entity of the chosen kind at a glance with conflict coloring; tile click navigates to detail.
**Verify:** visual check that tile count matches master list count.

## T8 — Master CRUD + Meeting editor + Save  → **CP-C**
- [ ] CRUD for Section (incl. headcount, theory/practical hours), Instructor, Room (incl. capacity)
- [ ] Add/edit/delete Meeting (day, time, section, instructors[], room)
- [ ] Save button → `PUT /api/data`; on stale-version response, re-fetch latest, re-apply the pending change, retry (auto-merge)

**Acceptance:** edits persist via Blob and reload for a second browser; a simulated concurrent edit does not silently lose work (auto-merge or clear reload prompt).
**Verify:** two-tab test: edit in tab A, edit+save in tab B, then save tab A → no data loss.
**🛑 CHECKPOINT C:** validate conflicts + concurrency before print polish.

## T9 — Schedule Sheet (print / PDF, matches original)
- [ ] Per-Section printable sheet: top course table (code, name, ท/ป hours, instructor) + weekly grid
- [ ] Print stylesheet / export to PDF, layout matching the original PDF for board posting

**Acceptance:** printed/exported sheet for a Section visually matches the original PDF layout closely enough to post on a board.
**Verify:** print-preview a Section, compare side-by-side with its source PDF.

---

## Suggested phasing
- **Foundation:** T1 · T2 · T3 → T4 → **CP-A**
- **First light:** T5 → **CP-B**
- **Breadth:** T6 · T7
- **Editing:** T8 → **CP-C**
- **Output:** T9
