# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Thai university timetable parser. It reads schedule PDFs (e.g., `CE6541-01.pdf`) exported from a TMS (Timetable Management System) and extracts structured course/schedule data into CSV format.

**Dependency:** `pdfplumber` — install with `pip install pdfplumber`.

## Commands

```bash
# Run the main pipeline (parses all PDFs in example/ → combined_courses.csv)
python generate_csv.py

# Run exploratory/debug scripts on a single PDF
python extract_tables.py
python test_parse.py
python analyze_boxes.py
python extract_cells.py
```

## Architecture

The pipeline has two stages per PDF:

### Stage 1 — Course metadata (top table)
`page.extract_tables()[0]` returns the course listing table at the top of each page. Rows are matched by regex `(EN-[0-9A-Z\-]+|[0-9]{8})` at column 6. Fixed column offsets extract instructor (col 20), theory hours (col 17), and practical hours (col 18).

### Stage 2 — Schedule blocks (spatial geometry)
`page.find_tables()[0].cells` returns raw bounding boxes. Each cell is cropped and text-searched for `EN-` course codes. Time-of-day is computed from the cell's `x0` coordinate using a hardcoded pixel-to-hour formula:

```python
start_hour = 8 + round((x0 - 69.13) / 54.14)
duration   = round((x1 - x0) / 54.14)
```

Day-of-week is resolved by matching the cell's `top` Y-coordinate against the Y positions of Thai day labels (`จันทร์`…`อาทิตย์`) found in the left margin (x0 < 100).

Adjacent cells for the same course on the same day are merged by contiguous-interval logic before writing output.

### Output schema (CSV, UTF-8 BOM)
| Column | Meaning |
|---|---|
| รหัสห้องเรียน | Class group (from filename prefix, e.g. `CE6541`) |
| อาจารย์ผู้สอน | Instructor name |
| จำนวนชมที่สอน (ท + ป) | Total contact hours (theory + practical) |
| เวลาเริ่มสอน | Start hour (e.g. `8.00`) |
| เวลาสิ้นสุดสอน | End hour |
| ชื่อห้องสอน | Room name |

## Key assumptions baked into the pixel math

- Schedule grid starts at `x0 = 69.13` px
- Each hour slot is `54.14` px wide
- First slot = 08:00
- Day label cells have `x0 < 100`
- Schedule rows begin after the first day label's Y coordinate minus 20 px

If PDFs from a different term or printer have different layout metrics, these constants must be recalibrated using `analyze_boxes.py` and `extract_cells.py`.
