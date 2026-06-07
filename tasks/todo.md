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

## T6 — Instructor + Room views  ✅
- [x] View-kind toggle (กลุ่มเรียน / อาจารย์ / ห้องเรียน) + entity selector; reuses `Timetable`
- [x] Deep-linkable URL (`?view=room&id=r1`) — also enables T7 tile → detail navigation
- [x] Block now shows section code (matters in room/instructor views)
- [x] **Rule fix found via real data:** instructor co-teaching exception keys on course CODE, not
      per-section courseId — same subject taught to two sections at once (combined class) is not a conflict

**Acceptance:** ✅ room r1: 4 red (combined 40 > cap 35) + 5 blue; instructor i1: 0 red / 11 blue
(all overlaps are same-subject combined classes). Unit test still flags different-subject instructor
double-booking. 21 tests pass.
**Verify:** ✅ DOM-inspected live views + unit tests + build. (Screenshots flaky in this env.)

## T7 — Overview (colored small-multiples)  ✅
- [x] `/overview` page with view-kind toggle; tile grid of `MiniTimetable` (compact label-less day×hour bars)
- [x] Conflict-colored bars + per-tile conflict badge; tiles link to `/?view=&id=` detail (T5/T6)

**Acceptance:** ✅ room kind → 10 tiles (= rooms), 6 with conflict badges, 52 bars total (= meetings),
tiles deep-link to detail.
**Verify:** ✅ DOM-inspected live overview + build.

## T8 — Master CRUD + Meeting editor + Save  ✅  → **CP-C**
- [x] `/masters` with tabs: คาบสอน / รายวิชา / กลุ่มเรียน / อาจารย์ / ห้องเรียน — inline add/edit/delete
- [x] Course CRUD (code, name, section, ท/ป, instructors multi-select); Section (code/name/headcount); Room (name/capacity); Instructor (name); Meeting (course/room/day/start/end)
- [x] `lib/ops.ts` diffDataset + applyOps (7 unit tests); sticky Save bar with live change count
- [x] `persistDataset`: PUT draft; on 409 re-apply diff onto server latest and retry (auto-merge)

**Acceptance:** ✅ two-tab concurrency proven live: tab B saves room cap=99, tab A (stale baseline) renames instructor → 409 → auto-merge → final v3 keeps BOTH changes (no data loss). UI: add row → dirty count + Save enabled.
**Verify:** ✅ live API concurrency scenario + DOM-inspected masters UI + 28 unit tests + build.
**🛑 CHECKPOINT C:** validate conflicts + concurrency before print polish.

## T9 — Schedule Sheet (print / PDF, matches original)  ✅
- [x] `/sheet`: per-Section printable sheet — header (มหาวิทยาลัยกาฬสินธุ์ + กลุ่มเรียน), top course
      table (ที่/รหัสวิชา/ชื่อวิชา/ท/ป/รวม/ผู้สอน), and the weekly grid (reuses `Timetable`)
- [x] Print stylesheet (`@media print`, A4 landscape, `.no-print` hides nav/controls); window.print() button

**Acceptance:** ✅ CE6541 sheet matches the source PDF's top table exactly (e.g. row 1: EN-001-016
การเขียนโปรแกรมและแก้ปัญหา ท=1 ป=2 รวม=3 อ.สรายุทธ กรวิรัตน์) + weekly grid below.
**Verify:** ✅ DOM-inspected sheet vs original PDF + build.

---

## Suggested phasing
- **Foundation:** T1 · T2 · T3 → T4 → **CP-A**
- **First light:** T5 → **CP-B**
- **Breadth:** T6 · T7
- **Editing:** T8 → **CP-C**
- **Output:** T9
