import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseDrawHtml } from "./parser.js";

const fixture = readFileSync(
  join(import.meta.dirname, "fixtures", "draw-4159.html"),
  "utf-8",
);

describe("parseDrawHtml", () => {
  it("parses draw number", () => {
    const result = parseDrawHtml(fixture);
    expect(result!.drawNumber).toBe(4159);
  });

  it("parses draw date to ISO format", () => {
    const result = parseDrawHtml(fixture);
    expect(result!.drawDate).toBe("2026-02-23");
  });

  it("parses 6 winning numbers", () => {
    const result = parseDrawHtml(fixture);
    expect(result!.numbers).toEqual([24, 26, 30, 32, 37, 47]);
  });

  it("parses additional number", () => {
    const result = parseDrawHtml(fixture);
    expect(result!.additional).toBe(2);
  });

  it("parses 7 prize groups", () => {
    const result = parseDrawHtml(fixture);
    expect(result!.prizes).toHaveLength(7);
    expect(result!.prizes[0]).toEqual({ group: 1, shareAmount: 893718, winners: 2 });
    expect(result!.prizes[4]).toEqual({ group: 5, shareAmount: 50, winners: 6204 });
    expect(result!.prizes[6]).toEqual({ group: 7, shareAmount: 10, winners: 122832 });
  });

  it("returns null for invalid/empty HTML", () => {
    expect(parseDrawHtml("<html></html>")).toBeNull();
    expect(parseDrawHtml("")).toBeNull();
  });

  it("handles draw with bogus date (pre-1194 draws)", () => {
    const html = fixture.replace("Mon, 23 Feb 2026", "Mon, 01 Jan 0001");
    const result = parseDrawHtml(html);
    expect(result).toBeNull();
  });
});
