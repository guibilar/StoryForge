import { describe, expect, it } from "vitest";

import { scoreMatch } from "./commandScore";

describe("scoreMatch", () => {
  it("returns 0 for an empty query (matches everything, ties)", () => {
    expect(scoreMatch("", "Carlos Mendoza")).toBe(0);
    expect(scoreMatch("   ", "Carlos Mendoza")).toBe(0);
  });

  it("scores an exact match highest", () => {
    expect(scoreMatch("carlos", "Carlos")).toBe(100);
  });

  it("scores a prefix match above a mid-string match", () => {
    const prefix = scoreMatch("car", "Carlos Mendoza");
    const midString = scoreMatch("men", "Carlos Mendoza");
    expect(prefix).toBeGreaterThan(midString);
  });

  it("scores an earlier substring match above a later one", () => {
    const earlier = scoreMatch("men", "Mendoza Carlos");
    const later = scoreMatch("men", "Carlos Mendoza");
    expect(earlier).toBeGreaterThan(later);
  });

  it("returns -1 when there's no match", () => {
    expect(scoreMatch("xyz", "Carlos Mendoza")).toBe(-1);
  });

  it("is case-insensitive", () => {
    expect(scoreMatch("CARLOS", "carlos mendoza")).toBe(80);
  });
});
