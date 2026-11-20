import type { Idea, Stage } from "@/lib/ideas";
import { ideaTitle, inPeriod } from "@/lib/ideas";
import { topDarkHorses } from "@/lib/boards";

const DAY = 86_400_000;
type Raw = Idea & { opened?: string | null; closed?: string | null };

export type FeedKind = "open" | "close" | "target" | "approach" | "win" | "loss" | "hero" | "stat";
export interface FeedEvent {
  id: string;
  kind: FeedKind;
  text: string;
  idea?: Idea;
  ticker?: string;
  analyst?: string;
  count?: number;
  shortCount?: number;
  /** upside or result, shown at the right end of the line */ value?: string;
  /** company / instrument / portfolio name, shown at the left end */ name?: string;
  /** state of the idea: взлёт / в полёте / посадка / закрыта ... */ status?: string | undefined;
}

const plural = (k: number) => (k % 10 === 1 && k % 100 !== 11 ? "идея" : k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 12 || k % 100 > 14) ? "идеи" : "идей");
const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%`;
const age = (d: string | null | undefined, now: number) => (d ? Math.round((now - Date.parse(d.slice(0, 10))) / DAY) : Infinity);

/** state of an idea, worded like the map zones */
// only the four statuses the user named; other stages carry no status
const STAGE_STATUS: Partial<Record<Stage, string>> = { liftoff: "взлёт", cruise: "в полёте", approach: "посадка", landed: "достигли цели" };
function statusOf(i: Idea): string | undefined {
  if (i.status === "closed") return i.stage === "landed" ? "достигли цели" : "закрыта";
  return STAGE_STATUS[i.stage];
}

/** deterministic shuffle so the order looks random but is stable for one snapshot */
function shuffle<T>(list: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    const left = out[i];
    const right = out[j];
    if (left !== undefined && right !== undefined) [out[i], out[j]] = [right, left];
  }
  return out;
}

/**
 * Ticker-tape feed: up to n events. Fresh events (opened within 1 day, closed within 1 day) come first,
 * then landing-zone entries, extreme yields, new heroes and flow statistics fill the rest.
 * Each line carries the company name on the left and the state of the idea on the right.
 */
export function weeklySummary(ideas: Idea[], asOf: string) {
  const week = ideas.filter((i) => inPeriod(i, "week", asOf));
  const stocks = new Map(ideas.filter((i) => !i.basket && i.assetType === "stock").map((i) => [i.ticker, i.name]));
  const byStock = new Map<string, number>();
  const byAnalyst = new Map<string, number>();
  for (const i of week) {
    byAnalyst.set(i.analyst, (byAnalyst.get(i.analyst) ?? 0) + 1);
    const codes = i.basket ? i.ticker.split(/[,;\s]+/).filter(Boolean) : [i.ticker];
    for (const code of codes) if (stocks.has(code)) byStock.set(code, (byStock.get(code) ?? 0) + 1);
  }
  const rank = (entries: Map<string, number>) => [...entries].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const stock = rank(byStock);
  const analyst = rank(byAnalyst);
  return {
    count: week.length,
    shortCount: week.filter((i) => i.strategy === "шорт").length,
    stock: stock ? { ticker: stock[0], name: stocks.get(stock[0]) || stock[0], count: stock[1] } : undefined,
    analyst: analyst ? { name: analyst[0], count: analyst[1] } : undefined,
  };
}

export function buildFeed(ideas: Idea[], asOf: string, n = 20): FeedEvent[] {
  const now = Date.parse(asOf.slice(0, 10));
  const raw = ideas as Raw[];
  const out: FeedEvent[] = [];
  const summary = weeklySummary(ideas, asOf);
  const stats: FeedEvent[] = [];
  if (summary.count > 0) {
    stats.push({ id: "s-short", kind: "stat", count: summary.count, shortCount: summary.shortCount, text: `${summary.count} ${plural(summary.count)} за неделю, из них ${summary.shortCount} в шорт` });
    if (summary.stock) stats.push({ id: `s-${summary.stock.ticker}`, kind: "stat", ticker: summary.stock.ticker, count: summary.stock.count, text: `Самая популярная акция недели ${summary.stock.name}: ${summary.stock.count} ${plural(summary.stock.count)}` });
    if (summary.analyst) stats.push({ id: "s-analyst", kind: "stat", analyst: summary.analyst.name, count: summary.analyst.count, text: `Самый активный аналитик недели ${summary.analyst.name}: ${summary.analyst.count} ${plural(summary.analyst.count)}` });
  }
  const ideaLimit = Math.max(0, n - stats.length);
  const used = new Set<Idea["id"]>();
  const push = (e: FeedEvent) => { if (out.length >= ideaLimit) return; if (e.idea) { if (used.has(e.idea.id)) return; used.add(e.idea.id); } out.push(e); };
  /** every idea line repeats the name and the state the component prints itself */
  const ideaEvent = (e: Omit<FeedEvent, "name" | "status"> & { idea: Idea }): FeedEvent =>
    ({ ...e, name: ideaTitle(e.idea), status: statusOf(e.idea) });

  const fresh: FeedEvent[] = [];
  for (const i of raw) {
    if (i.status === "closed" && age(i.closed, now) <= 1) {
      const hit = i.stage === "landed";
      fresh.push(ideaEvent({ id: `c${i.id}`, kind: hit ? "target" : "close", idea: i, text: "идея закрыта", value: `результат ${pct(i.yieldPct)}` }));
    } else if (age(i.opened, now) <= 1 && age(i.opened, now) >= 0) {
      const up = !i.noTarget && i.toTargetPct != null ? `апсайд ${pct(((i as Idea & { upsidePct?: number }).upsidePct ?? 0))}` : undefined;
      fresh.push(ideaEvent({ id: `o${i.id}`, kind: "open", idea: i, text: "новая идея", ...(up ? { value: up } : {}) }));
    }
  }
  fresh.sort((a, b) => Date.parse((b.idea as Raw).closed ?? (b.idea as Raw).opened ?? "") - Date.parse((a.idea as Raw).closed ?? (a.idea as Raw).opened ?? ""));
  fresh.forEach(push);

  const active = raw.filter((i) => i.status === "active");
  const extra: FeedEvent[] = [];
  for (const i of active.filter((x) => x.stage === "approach").slice(0, 4))
    extra.push(ideaEvent({ id: `a${i.id}`, kind: "approach", idea: i, text: "почти у цели", value: `прибыль ${pct(i.yieldPct)}` }));
  for (const i of [...active].sort((a, b) => b.yieldPct - a.yieldPct).slice(0, 2))
    if (i.yieldPct >= 30) extra.push(ideaEvent({ id: `w${i.id}`, kind: "win", idea: i, text: "рекорд в воздухе", value: `прибыль ${pct(i.yieldPct)}` }));
  for (const i of [...active].sort((a, b) => a.yieldPct - b.yieldPct).slice(0, 2))
    if (i.yieldPct <= -25) extra.push(ideaEvent({ id: `l${i.id}`, kind: "loss", idea: i, text: "турбулентность", value: `убыток ${pct(i.yieldPct)}` }));
  for (const h of topDarkHorses(ideas, asOf, 2))
    extra.push({ id: `h${h.ticker}`, kind: "hero", ticker: h.ticker, name: h.name || h.ticker, status: "герой", text: `${h.count} ${plural(h.count)} за 60 дней` });

  extra.forEach(push);
  return shuffle([...out, ...stats].slice(0, n), asOf);
}
