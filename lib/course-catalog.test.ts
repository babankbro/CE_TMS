import { describe, it, expect } from "vitest";
import { COURSE_CATALOG } from "./course-catalog";

const CATEGORIES = [
  "ศึกษาทั่วไป (พื้นฐาน)",
  "ศึกษาทั่วไป (เลือก)",
  "วิชาแกน",
  "วิชาเฉพาะด้าน",
  "โครงงานและสัมมนา",
  "วิชาชีพเลือก",
  "ประสบการณ์ภาคสนาม",
];

const byCode = (code: string) => COURSE_CATALOG.find((e) => e.code === code)!;

describe("COURSE_CATALOG", () => {
  it("contains 79 entries", () => {
    expect(COURSE_CATALOG).toHaveLength(79);
  });

  it("uses the course code as the id of every entry", () => {
    for (const e of COURSE_CATALOG) {
      expect(e.id).toBe(e.code);
    }
  });

  it("has unique codes in the XX-000-000 format", () => {
    const codes = COURSE_CATALOG.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{2}-\d{3}-\d{3}$/);
    }
  });

  it("has a non-empty name and a known category on every entry", () => {
    for (const e of COURSE_CATALOG) {
      expect(typeof e.name).toBe("string");
      expect(e.name.length).toBeGreaterThan(0);
      expect(typeof e.category).toBe("string");
      expect(e.category.length).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(e.category);
    }
  });

  it("has positive integer credits on every entry", () => {
    // guards against a row silently falling back to 0 when the hours format fails to parse
    for (const e of COURSE_CATALOG) {
      expect(Number.isInteger(e.credits)).toBe(true);
      expect(e.credits).toBeGreaterThan(0);
    }
  });

  it("has non-negative integer theory and practical hours", () => {
    for (const e of COURSE_CATALOG) {
      expect(Number.isInteger(e.theoryHours)).toBe(true);
      expect(e.theoryHours).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(e.practicalHours)).toBe(true);
      expect(e.practicalHours).toBeGreaterThanOrEqual(0);
    }
  });

  it.each([
    ["GE-010-001", 3, 3, 0],
    ["EN-001-018", 1, 0, 3],
    ["EN-001-020", 2, 1, 2],
    ["EN-013-310", 3, 0, 40], // two-digit practical hours
    ["EN-015-420", 6, 0, 40],
  ])("parses %s as credits %i, theory %i, practical %i", (code, credits, theoryHours, practicalHours) => {
    expect(byCode(code)).toMatchObject({ credits, theoryHours, practicalHours });
  });

  it("has exactly the CatalogEntry keys (self-study hours are not stored)", () => {
    for (const e of COURSE_CATALOG) {
      expect(Object.keys(e).sort()).toEqual([
        "category",
        "code",
        "credits",
        "id",
        "name",
        "practicalHours",
        "theoryHours",
      ]);
    }
  });
});
