import { describe, it, expect } from "vitest";
import { applyFilters, type FlightResponse, type Idea } from "@/lib/ideas";

const idea = (o: Partial<Idea> & { opened: string }): Idea => ({
  id: Math.random(), ticker: "GAZP", name: "Газпром", analyst: "A", strategy: "лонг", status: "active",
  openedLabel: "", start: 1, current: 1, target: 2, yieldPct: 0, toTargetPct: 0, noTarget: false, capturedX: 0, stage: "cold", ...o,
} as Idea);
const all = {
  asOf: "2026-11-04", from: "", to: "", yieldMin: -10, yieldMax: 10, counts: {} as never, periods: {} as never, analysts: [], instruments: [],
  ideas: [
    idea({ opened: "2026-11-01", stage: "liftoff" }),
    idea({ opened: "2026-10-05", status: "closed", stage: "landed", analyst: "B", ticker: "SBER", name: "Сбер" }),
    idea({ opened: "2026-06-01" }),
  ],
} as FlightResponse;

describe("local filters", () => {
  it("week = opened within 7 days of asOf, month = 30", () => {
    const r = applyFilters(all, { period: "all", book: "all", analyst: "", ticker: "" });
    expect(r.periods).toEqual({ all: 3, month: 2, week: 1 });
  });
  it("book filters by status and counts stages of the result", () => {
    const r = applyFilters(all, { period: "all", book: "closed", analyst: "", ticker: "" });
    expect(r.ideas.length).toBe(1);
    expect(r.counts.landed).toBe(1);
    expect(r.counts.active).toBe(2);
  });
  it("analyst is exact match, ticker searches ticker/name", () => {
    expect(applyFilters(all, { period: "all", book: "all", analyst: "B", ticker: "" }).ideas.length).toBe(1);
    expect(applyFilters(all, { period: "all", book: "all", analyst: "", ticker: "сбер" }).ideas.length).toBe(1);
  });
});
