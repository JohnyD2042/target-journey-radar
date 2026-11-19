import type { Idea, Stage } from "@/lib/ideas";
import { ideaTitle } from "@/lib/ideas";
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
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Ticker-tape feed: up to n events. Fresh events (opened within 1 day, closed within 1 day) come first,
 * then landing-zone entries, extreme yields, new heroes and flow statistics fill the rest.
 * Each line carries the company name on the left and the state of the idea on the right.
 */
export function buildFeed(ideas: Idea[], asOf: string, n = 20): FeedEvent[] {
  const now = Date.parse(asOf.slice(0, 10));
  const raw = ideas as Raw[];
  const out: FeedEvent[] = [];
  const used = new Set<Idea["id"]>();
  const push = (e: FeedEvent) => { if (out.length >= n) return; if (e.idea) { if (used.has(e.idea.id)) return; used.add(e.idea.id); } out.push(e); };
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

  const week = raw.filter((i) => age(i.opened, now) >= 0 && age(i.opened, now) <= 7);
  if (week.length >= 3) {
    const shorts = week.filter((i) => i.strategy === "шорт").length;
    extra.push({ id: "s-short", kind: "stat", text: `За неделю ${week.length} новых ${plural(week.length)}, ${Math.round((shorts / week.length) * 100)}% в шорт` });
    const by = new Map<string, { count: number; name: string }>();
    for (const i of week) if (!i.basket) {
      const e = by.get(i.ticker) ?? { count: 0, name: i.name };
      e.count++;
      if (!e.name) e.name = i.name;
      by.set(i.ticker, e);
    }
    const top = [...by].sort((a, b) => b[1].count - a[1].count)[0];
    if (top && top[1].count >= 2)
      extra.push({ id: `s-${top[0]}`, kind: "stat", ticker: top[0], name: top[1].name || top[0], text: `самый обсуждаемый актив недели: ${top[1].count} ${plural(top[1].count)}` });
  }
  extra.forEach(push);
  return shuffle(out, asOf);
}
