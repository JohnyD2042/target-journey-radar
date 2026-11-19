import type { Idea } from "@/lib/ideas";
import { topDarkHorses } from "@/lib/boards";

const DAY = 86_400_000;
type Raw = Idea & { opened?: string | null; closed?: string | null };

export type FeedKind = "open" | "close" | "target" | "approach" | "win" | "loss" | "hero" | "stat";
export interface FeedEvent { id: string; kind: FeedKind; text: string; idea?: Idea; ticker?: string; /** upside or result, shown last */ value?: string }

const plural = (k: number) => (k % 10 === 1 && k % 100 !== 11 ? "идея" : k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 12 || k % 100 > 14) ? "идеи" : "идей");
const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%`;
const age = (d: string | null | undefined, now: number) => (d ? Math.round((now - Date.parse(d.slice(0, 10))) / DAY) : Infinity);

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
 */
export function buildFeed(ideas: Idea[], asOf: string, n = 20): FeedEvent[] {
  const now = Date.parse(asOf.slice(0, 10));
  const raw = ideas as Raw[];
  const out: FeedEvent[] = [];
  const used = new Set<Idea["id"]>();
  const push = (e: FeedEvent) => { if (out.length >= n) return; if (e.idea) { if (used.has(e.idea.id)) return; used.add(e.idea.id); } out.push(e); };

  const fresh: FeedEvent[] = [];
  for (const i of raw) {
    if (i.status === "closed" && age(i.closed, now) <= 1) {
      const hit = i.stage === "landed";
      fresh.push({ id: `c${i.id}`, kind: hit ? "target" : "close", idea: i, text: hit ? "цель достигнута" : "идея закрыта", value: `результат ${pct(i.yieldPct)}` });
    } else if (age(i.opened, now) <= 1 && age(i.opened, now) >= 0) {
      const up = !i.noTarget && i.toTargetPct != null ? `апсайд ${pct(((i as Idea & { upsidePct?: number }).upsidePct ?? 0))}` : undefined;
      fresh.push({ id: `o${i.id}`, kind: "open", idea: i, text: "новая идея", ...(up ? { value: up } : {}) });
    }
  }
  fresh.sort((a, b) => Date.parse((b.idea as Raw).closed ?? (b.idea as Raw).opened ?? "") - Date.parse((a.idea as Raw).closed ?? (a.idea as Raw).opened ?? ""));
  fresh.forEach(push);

  const active = raw.filter((i) => i.status === "active");
  const extra: FeedEvent[] = [];
  for (const i of active.filter((x) => x.stage === "approach").slice(0, 4))
    extra.push({ id: `a${i.id}`, kind: "approach", idea: i, text: "заходит на посадку", value: `прибыль ${pct(i.yieldPct)}` });
  for (const i of [...active].sort((a, b) => b.yieldPct - a.yieldPct).slice(0, 2))
    if (i.yieldPct >= 30) extra.push({ id: `w${i.id}`, kind: "win", idea: i, text: "рекорд в воздухе", value: `прибыль ${pct(i.yieldPct)}` });
  for (const i of [...active].sort((a, b) => a.yieldPct - b.yieldPct).slice(0, 2))
    if (i.yieldPct <= -25) extra.push({ id: `l${i.id}`, kind: "loss", idea: i, text: "турбулентность", value: `убыток ${pct(i.yieldPct)}` });
  for (const h of topDarkHorses(ideas, asOf, 2))
    extra.push({ id: `h${h.ticker}`, kind: "hero", ticker: h.ticker, text: `${h.name || h.ticker} · новый герой: ${h.count} ${plural(h.count)} за 60 дней` });

  const week = raw.filter((i) => age(i.opened, now) >= 0 && age(i.opened, now) <= 7);
  if (week.length >= 3) {
    const shorts = week.filter((i) => i.strategy === "шорт").length;
    extra.push({ id: "s-short", kind: "stat", text: `За неделю ${week.length} новых идей · ${Math.round((shorts / week.length) * 100)}% в шорт` });
    const by = new Map<string, number>();
    for (const i of week) if (!i.basket) by.set(i.ticker, (by.get(i.ticker) ?? 0) + 1);
    const top = [...by].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) extra.push({ id: `s-${top[0]}`, kind: "stat", ticker: top[0], text: `${top[0]} · самый обсуждаемый актив недели: ${top[1]} ${plural(top[1])}` });
  }
  extra.forEach(push);
  return shuffle(out, asOf);
}
