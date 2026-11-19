import { describe, it, expect } from "vitest";
import { buildFeed } from "@/lib/feed";
import type { Idea } from "@/lib/ideas";

const idea = (o: Partial<Idea> & Record<string, unknown>): Idea => ({
  id: Math.random(), ticker: "AAA", name: "Абсолют-Холдинг", analyst: "Икс-Капитал", strategy: "лонг", status: "active", openedLabel: "", start: 1, current: 1,
  target: 2, yieldPct: 1, toTargetPct: 50, noTarget: false, capturedX: 0, stage: "cruise", opened: "2026-01-01", ...o,
} as Idea);

const STATES = ["взлёт", "в полёте", "посадка", "закрыта"];

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

  it("names the company, not the short ticker, and puts the state last", () => {
    const ideas = [
      idea({ id: 1, ticker: "VKCO", name: "ВККО", analyst: "Риком-Траст", opened: "2026-11-19", yieldPct: 83, strategy: "лонг" }),
      idea({ id: 2, ticker: "GEMA", name: "Гематрон", analyst: "Финам", opened: "2026-11-19", yieldPct: -40, strategy: "шорт" }),
      idea({ id: 3, ticker: "BELU", name: "Белая Дамочка", analyst: "СберИнвестиции", status: "closed", closed: "2026-11-19", yieldPct: 12, stage: "landed" }),
      idea({ id: 4, ticker: "MGKL", name: "Мостотрест", analyst: "БКС", status: "closed", closed: "2026-11-19", yieldPct: -31, stage: "cold" }),
    ];
    const f = buildFeed(ideas, "2026-11-19");
    expect(f.length).toBeGreaterThan(0);
    for (const e of f) {
      const line = `${e.text} ${e.value ?? ""}`;
      // every line ends with a state word the component prints itself
      if (e.status !== undefined) expect(STATES).toContain(e.status);
      if (e.idea) {
        // the component prints name + analyst itself, so the text must stay clean
        expect(line).not.toContain(e.idea.ticker);
        expect(line).not.toContain(e.idea.analyst);
        expect(line).not.toContain(e.idea.name);
        // the name shown is the company name, never the short ticker
        expect(e.name).toBe(e.idea.basket ? (e.idea.title ?? e.idea.name) : e.idea.name);
      } else if (e.ticker) {
        // summary lines may name the asset by display name instead of ticker, but never twice
        expect(line.split(e.ticker).length - 1).toBeLessThanOrEqual(1);
      }
    }
    const closedByTarget = f.find((e) => e.idea?.id === 3);
    expect(closedByTarget?.status).toBe("закрыта");
    const closedByStop = f.find((e) => e.idea?.id === 4);
    expect(closedByStop?.status).toBe("закрыта");
  });

  it("words the state like the map zones for ideas still in the air", () => {
    const f = buildFeed(
      [
        idea({ id: 1, opened: "2026-11-19", stage: "liftoff" }),
        idea({ id: 2, opened: "2026-11-19", stage: "cruise" }),
        idea({ id: 3, opened: "2026-11-19", stage: "approach" }),
        idea({ id: 4, opened: "2026-11-19", stage: "cold", yieldPct: -8 }),
      ],
      "2026-11-19",
    );
    const byId = new Map(f.map((e) => [e.idea?.id, e.status]));
    expect(byId.get(1)).toBe("взлёт");
    expect(byId.get(2)).toBe("в полёте");
    expect(byId.get(3)).toBe("посадка");
    expect(byId.get(4)).toBeUndefined();
  });
});
