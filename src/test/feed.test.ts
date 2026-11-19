import { describe, it, expect } from "vitest";
import { buildFeed } from "@/lib/feed";
import type { Idea } from "@/lib/ideas";

const idea = (o: Partial<Idea> & Record<string, unknown>): Idea => ({
  id: Math.random(), ticker: "AAA", name: "A", analyst: "X", strategy: "лонг", status: "active", openedLabel: "", start: 1, current: 1,
  target: 2, yieldPct: 1, toTargetPct: 50, noTarget: false, capturedX: 0, stage: "cruise", opened: "2026-01-01", ...o,
} as Idea);

describe("buildFeed", () => {
  it("includes ideas opened or closed within the last day and caps at 20", () => {
    const ideas = [
      idea({ id: 1, opened: "2026-11-19" }),
      idea({ id: 2, status: "closed", closed: "2026-11-18" }),
      idea({ id: 3, opened: "2026-11-10" }),
      ...Array.from({ length: 30 }, (_, k) => idea({ id: 100 + k, opened: "2026-11-19" })),
    ];
    const f = buildFeed(ideas, "2026-11-19");
    expect(f).toHaveLength(20);
    const all = buildFeed(ideas.slice(0, 3), "2026-11-19");
    expect(all.some((e) => e.idea?.id === 1 && e.kind === "open")).toBe(true);
    expect(all.some((e) => e.idea?.id === 2 && e.kind === "close")).toBe(true);
    expect(all.some((e) => e.idea?.id === 3)).toBe(false);
  });
});
