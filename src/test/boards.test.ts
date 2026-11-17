import { describe, it, expect } from "vitest";
import { topClimbers, topPunctual, thrustEngines, topUpside, topDarkHorses } from "@/lib/boards";
import type { Idea } from "@/lib/ideas";

const idea = (o: Partial<Idea> & { opened?: string }): Idea => ({
  id: Math.random(), ticker: "X", name: "X", analyst: "A", strategy: "лонг", status: "active", opened: "2026-11-04",
  openedLabel: "", start: 1, current: 1, target: 2, yieldPct: 1, toTargetPct: 0, noTarget: false, capturedX: 0, stage: "liftoff", ...o,
} as Idea);

describe("Набирают высоту", () => {
  it("ranks by yield per day: 10% over 10 days beats 30% over 20 days? no — 1.5 > 1", () => {
    const a = idea({ yieldPct: 10, opened: "2026-11-04" }); // 10 days → 1%/day
    const b = idea({ yieldPct: 30, opened: "2026-10-25" }); // 20 days → 1.5%/day
    const r = topClimbers([a, b], "2026-11-14");
    expect(r.map((c) => c.idea)).toEqual([b, a]);
    expect(r[0]?.perDay).toBe(1.5);
  });
  it("keeps only active, positive, opened within 30 days", () => {
    const r = topClimbers([
      idea({ opened: "2026-10-10" }), idea({ status: "closed" }), idea({ yieldPct: -2 }), idea({ yieldPct: 0 }),
    ], "2026-11-14");
    expect(r).toHaveLength(0);
  });
  it("reports the age in days used by the thrust formula", () => {
    const r = topClimbers([idea({ yieldPct: 10, opened: "2026-11-04" })], "2026-11-14");
    expect(r[0]?.days).toBe(10);
    expect(r[0]?.perDay).toBe(1);
  });
  it("shows at most 5", () => {
    expect(topClimbers(Array.from({ length: 8 }, () => idea({})), "2026-11-14")).toHaveLength(5);
  });
  it("keeps strictly less than 0.5X or ideas without a target", () => {
    const early = idea({ capturedX: 0.49 });
    const noTarget = idea({ capturedX: 0.5, noTarget: true });
    expect(topClimbers([early, idea({ capturedX: 0.5 }), idea({ capturedX: 0.8 }), noTarget], "2026-11-14").map((c) => c.idea)).toEqual([early, noTarget]);
  });
  it("represents 3.8 percent per day with four engines", () => {
    expect(thrustEngines(3.8)).toBe(4);
  });
  it("rounds two and one percent per day to two and one engines", () => {
    expect(thrustEngines(2)).toBe(2);
    expect(thrustEngines(1)).toBe(1);
    expect(thrustEngines(0.2)).toBe(1);
    expect(thrustEngines(0)).toBe(0);
  });
});

describe("Пунктуальность аналитиков", () => {
  it("needs more than 3 ideas", () => {
    const three = [1, 2, 3].map(() => idea({ analyst: "A", stage: "landed" }));
    expect(topPunctual(three)).toHaveLength(0);
  });
  it("rate = (landed + approach) / total", () => {
    const list = [idea({ stage: "landed" }), idea({ stage: "approach" }), idea({ stage: "cold", yieldPct: -1 }), idea({ stage: "cruise" })];
    const [p] = topPunctual(list);
    expect(p?.onTarget).toBe(2);
    expect(p?.rate).toBe(50);
    expect(p?.positive).toBe(3);
  });
});

describe("Максимальный апсайд", () => {
  it("keeps active liftoff/cruise ideas with a target, sorted by upside", () => {
    const a = idea({ ticker: "AAA", stage: "liftoff", toTargetPct: 20 });
    const b = idea({ ticker: "BBB", stage: "cruise", toTargetPct: 50 });
    const r = topUpside([a, b, idea({ stage: "approach", toTargetPct: 90 }), idea({ stage: "cold", toTargetPct: 99 }),
      idea({ stage: "cruise", toTargetPct: 80, status: "closed" }), idea({ stage: "liftoff", toTargetPct: 70, noTarget: true })]);
    expect(r).toEqual([b, a]);
  });
  it("keeps one row per ticker — the idea with the highest upside", () => {
    const low = idea({ ticker: "KZOS", stage: "cruise", toTargetPct: 30 });
    const high = idea({ ticker: "KZOS", stage: "liftoff", toTargetPct: 55 });
    const other = idea({ ticker: "SBER", stage: "cruise", toTargetPct: 40 });
    const r = topUpside([low, high, other]);
    expect(r).toEqual([high, other]);
  });
});

describe("Тёмные лошадки", () => {
  const asOf = "2026-11-15T01:37:00Z";
  const openedAgo = (days: number) => new Date(Date.parse("2026-11-15") - days * 86_400_000).toISOString();
  it("includes active openings through day 60, excluding closed and future ideas", () => {
    const r = topDarkHorses([idea({ opened: openedAgo(60) }), idea({ status: "closed", opened: openedAgo(1) }), idea({ opened: openedAgo(-1) })], asOf);
    expect(r[0]?.count).toBe(1);
  });
  it("blocks a ticker for any opening from 61 through 150 days, even closed", () => {
    for (const days of [61, 100, 150]) {
      expect(topDarkHorses([idea({ opened: openedAgo(1) }), idea({ status: "closed", opened: openedAgo(days) })], asOf)).toEqual([]);
    }
  });
  it("keeps first appearances and histories older than 150 days", () => {
    const r = topDarkHorses([idea({ ticker: "NEW", opened: openedAgo(1) }), idea({ ticker: "OLD", opened: openedAgo(1) }), idea({ ticker: "OLD", opened: openedAgo(151) })], asOf);
    expect(r.map((x) => x.ticker).sort()).toEqual(["NEW", "OLD"]);
    expect(r.find((x) => x.ticker === "OLD")?.count).toBe(1);
  });
  it("counts only active ideas and lists their distinct authors", () => {
    const r = topDarkHorses([idea({ analyst: "A" }), idea({ analyst: "A" }), idea({ analyst: "B" }), idea({ analyst: "Closed", status: "closed" })], asOf);
    expect(r[0]?.count).toBe(3);
    expect(r[0]?.analysts).toEqual(["A", "B"]);
  });
  it("averages only recent active ideas with a target", () => {
    const r = topDarkHorses([idea({ toTargetPct: 20 }), idea({ toTargetPct: 60 }), idea({ noTarget: true, toTargetPct: 500 }), idea({ status: "closed", toTargetPct: 900 })], asOf);
    expect(r[0]?.averageUpside).toBe(40);
    expect(r[0]?.count).toBe(3);
    expect(topDarkHorses([idea({ noTarget: true })], asOf)[0]?.averageUpside).toBeNull();
  });
  it("orders by active count and returns five tickers at most", () => {
    const rows = Array.from({ length: 7 }, (_, k) => idea({ ticker: `T${k}`, toTargetPct: k }));
    rows.push(idea({ ticker: "T0", toTargetPct: 0 }));
    const r = topDarkHorses(rows, asOf);
    expect(r).toHaveLength(5);
    expect(r[0]?.ticker).toBe("T0");
    expect(r[0]?.count).toBe(2);
  });
  it("uses portfolio members as tickers without counting one idea twice", () => {
    expect(topDarkHorses([idea({ ticker: "X, X, Y", basket: true })], asOf).map((x) => x.count)).toEqual([1, 1]);
  });
});

import { topPredictable } from "@/lib/boards";
describe("topPredictable", () => {
  const mk = (id: number, ticker: string, y: number, basket = false) => ({ id, ticker, name: ticker, analyst: "a", strategy: "лонг", status: "closed", yieldPct: y, basket, stage: "cruise" }) as never;
  it("needs ≥3 ideas, counts baskets, ranks by share in plus", () => {
    const r = topPredictable([mk(1, "A", 5), mk(2, "A", 3), mk(3, "A, B", 1, true), mk(4, "B", -1), mk(5, "B", 2), mk(6, "C", 9)]);
    expect(r.map((x) => [x.ticker, x.positive, x.total])).toEqual([["A", 3, 3], ["B", 2, 3]]);
    expect(r[0]?.averageYield).toBe(3);
  });
});

import { topArrivals } from "@/lib/boards";
describe("topArrivals", () => {
  const mk = (id: number, o: Record<string, unknown>) => ({ id, ticker: `T${id}`, name: "n", analyst: "a", strategy: "лонг", status: "active", yieldPct: 1, noTarget: false, toTargetPct: 50, stage: "cruise", ...o }) as never;
  const asOf = "2026-11-17";
  it("orders landing → expiring → stop-loss → upside<3%, skips closed", () => {
    const r = topArrivals([mk(1, { yieldPct: -35 }), mk(2, { expectedEnd: "2026-11-18" }), mk(3, { toTargetPct: 2 }), mk(4, { stage: "approach" }), mk(5, { stage: "approach", status: "closed" })], asOf);
    expect(r.map((a) => [a.idea.id, a.reason])).toEqual([[4, "landing"], [2, "expiring"], [1, "stoploss"], [3, "upside"]]);
    expect(r[1]?.days).toBe(1);
  });
  it("treats upside of exactly 3% as not qualifying", () => {
    expect(topArrivals([mk(1, { toTargetPct: 3 })], asOf)).toEqual([]);
  });
  it("includes expiry in 0, 1, 2 days only, ordered nearest first", () => {
    const r = topArrivals([
      mk(1, { expectedEnd: "2026-11-19" }),
      mk(2, { expectedEnd: "2026-11-17" }),
      mk(3, { expectedEnd: "2026-11-18" }),
      mk(4, { expectedEnd: "2026-11-20" }),
      mk(5, { expectedEnd: "2026-11-16" }),
    ], asOf);
    expect(r.map((a) => [a.idea.id, a.reason, a.days])).toEqual([
      [2, "expiring", 0], [3, "expiring", 1], [1, "expiring", 2],
    ]);
  });
  it("stop-loss outranks upside and fills up to the limit", () => {
    const r = topArrivals([mk(1, { yieldPct: -35 }), mk(9, { yieldPct: -25 }), mk(2, { toTargetPct: 2 }), mk(3, { toTargetPct: 1 })], asOf, 2);
    expect(r.map((a) => a.idea.id)).toEqual([1, 3]);
  });
});
