import { describe, it, expect } from "vitest";
import { topClimbers, topPunctual, thrustEngines } from "@/lib/boards";
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
