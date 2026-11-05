import { describe, it, expect } from "vitest";
import { applyFilters, ideaTitle, isBasket, liveInAir, type FlightResponse, type Idea } from "@/lib/ideas";

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

describe("portfolio ideas", () => {
  const basket = idea({
    opened: "2026-11-02", ticker: "GAZP, NVTK, ROSN, LKOH", name: "Газпром",
    title: "Как заработать на расхождении нефти и газа?", basket: true,
    start: 100, current: 92.83, target: null, noTarget: true, yieldPct: -7.17,
    stage: "cold", status: "closed",
  });
  const plain = idea({ opened: "2026-11-02", ticker: "NVTK", name: "Новатэк" });
  const set = { ...all, ideas: [basket, plain] } as FlightResponse;
  const f = (ticker: string) => ({ period: "all" as const, book: "all" as const, analyst: "", ticker });

  it("stays one idea and keeps its ticker string whole", () => {
    const r = applyFilters(set, f(""));
    expect(r.ideas.length).toBe(2);
    expect(r.ideas.find((i) => isBasket(i))?.ticker).toBe("GAZP, NVTK, ROSN, LKOH");
  });
  it("is found when any code inside its ticker string is searched", () => {
    expect(applyFilters(set, f("rosn")).ideas.map((i) => i.ticker)).toEqual(["GAZP, NVTK, ROSN, LKOH"]);
    expect(applyFilters(set, f("nvtk")).ideas.length).toBe(2);
  });
  it("is described by its title, a single idea by its name", () => {
    expect(ideaTitle(basket)).toBe("Как заработать на расхождении нефти и газа?");
    expect(ideaTitle(plain)).toBe("Новатэк");
  });
});

describe("LIVE in the air", () => {
  const set: Idea[] = [
    idea({ opened: "2026-11-01", status: "active", yieldPct: 4.2 }),
    idea({ opened: "2026-11-01", status: "active", yieldPct: -1.5 }),
    idea({ opened: "2026-11-01", status: "active", yieldPct: 0 }),
    idea({ opened: "2026-11-01", status: "closed", yieldPct: 18 }),
    idea({ opened: "2026-11-01", status: "closed", yieldPct: -3 }),
  ];
  it("counts active ideas with a positive yield, nothing else", () => {
    expect(liveInAir(set)).toBe(1);
  });
  it("does not depend on the stage a plane sits in", () => {
    expect(liveInAir([idea({ opened: "2026-11-01", status: "active", stage: "landed", yieldPct: 12 })])).toBe(1);
    expect(liveInAir([idea({ opened: "2026-11-01", status: "closed", stage: "liftoff", yieldPct: 12 })])).toBe(0);
  });
});
