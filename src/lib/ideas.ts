export type Zone = 1 | 2 | 3 | 4 | 5;
export type Side = "long" | "short";

export interface Idea {
  id: string;
  ticker: string;
  name: string;
  analyst: string;
  side: Side;
  status: "active" | "closed";
  openDate: string; // ISO
  openPrice: number;
  price: number; // current or close price
  target: number | null;
}

export const ZONES: Record<Zone, { name: string; short: string; hint: string }> = {
  1: { name: "Не завелись", short: "На земле", hint: "доходность ниже нуля" },
  2: { name: "Взлет", short: "0 → 0,2x", hint: "до 20% пути" },
  3: { name: "В полете", short: "0,2x → 0,8x", hint: "20–80% пути" },
  4: { name: "Посадка", short: "0,8x → 1x", hint: "больше 80%" },
  5: { name: "Достигли цели", short: "1X Цель", hint: "закрыты по цели" },
};

export const ret = (i: Idea) =>
  i.side === "long" ? (i.price / i.openPrice - 1) * 100 : (1 - i.price / i.openPrice) * 100;

export const fullUpside = (i: Idea) =>
  i.target == null ? null : i.side === "long" ? (i.target / i.openPrice - 1) * 100 : (1 - i.target / i.openPrice) * 100;

/** Remaining upside from current price to target */
export const upside = (i: Idea) =>
  i.target == null ? null : i.side === "long" ? (i.target / i.price - 1) * 100 : (1 - i.target / i.price) * 100;

/** Share of path to target passed; ideas without target sit at 0.5 */
export const progress = (i: Idea) => {
  const f = fullUpside(i);
  if (f == null || f <= 0) return 0.5;
  return ret(i) / f;
};

export function zoneOf(i: Idea): Zone {
  const r = ret(i);
  if (i.status === "closed" && i.target != null && progress(i) >= 1) return 5;
  if (r < 0) return 1;
  if (i.target == null) return 3;
  const p = progress(i);
  if (p < 0.2) return 2;
  if (p < 0.8) return 3;
  return 4;
}

// ---------- demo data ----------
const TICKERS: [string, string][] = [
  ["SBER", "Сбербанк"], ["GAZP", "Газпром"], ["LKOH", "Лукойл"], ["YDEX", "Яндекс"], ["ROSN", "Роснефть"],
  ["NVTK", "Новатэк"], ["GMKN", "Норникель"], ["MGNT", "Магнит"], ["TCSG", "Т-Технологии"], ["PLZL", "Полюс"],
  ["CHMF", "Северсталь"], ["NLMK", "НЛМК"], ["MTSS", "МТС"], ["ALRS", "Алроса"], ["AFKS", "АФК Система"],
  ["OZON", "Озон"], ["PHOR", "ФосАгро"], ["MOEX", "Мосбиржа"], ["VTBR", "ВТБ"], ["TATN", "Татнефть"],
  ["HEAD", "Хэдхантер"], ["SMLT", "Самолёт"], ["PIKK", "ПИК"], ["AFLT", "Аэрофлот"], ["SNGSP", "Сургутнефтегаз ап"],
  ["IRAO", "Интер РАО"], ["RUAL", "Русал"], ["X5", "Икс 5"], ["POSI", "Позитив"], ["ASTR", "Астра"],
];
const ANALYSTS = ["Алексей Ковалёв", "Мария Орлова", "Дмитрий Соболев", "Ирина Лебедева", "Сергей Гранин", "Ольга Миронова", "Павел Тихонов"];

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export const TODAY = new Date("2026-11-03T12:00:00Z");
const START = new Date("2026-06-01T00:00:00Z");

export const IDEAS: Idea[] = (() => {
  const r = rng(42);
  const out: Idea[] = [];
  const span = TODAY.getTime() - START.getTime();
  for (let n = 0; n < 84; n++) {
    const entry = TICKERS[Math.floor(r() * TICKERS.length)];
    if (!entry) continue;
    const [ticker, name] = entry;
    const side: Side = r() < 0.78 ? "long" : "short";
    const openPrice = Math.round((50 + r() * 4000) * 10) / 10;
    const hasTarget = r() > 0.12;
    const up = 0.08 + r() * 0.4;
    const target = hasTarget ? Math.round(openPrice * (side === "long" ? 1 + up : 1 - up * 0.6) * 10) / 10 : null;
    // recent ideas cluster
    const age = Math.pow(r(), 1.4);
    const openDate = new Date(TODAY.getTime() - age * span);
    const closed = r() < 0.3 && age > 0.15;
    let p: number;
    if (closed) p = r() < 0.55 ? 1 + r() * 0.15 : -0.4 + r() * 1.2;
    else p = -0.6 + r() * 1.55;
    if (!closed && p >= 1) p = 0.97;
    const fu = target ? (side === "long" ? target / openPrice - 1 : 1 - target / openPrice) : 0.05 + r() * 0.25;
    const rr = p * fu;
    const price = Math.round(openPrice * (side === "long" ? 1 + rr : 1 - rr) * 10) / 10;
    out.push({
      id: `II-${1000 + n}`,
      ticker, name, side,
      analyst: ANALYSTS[Math.floor(r() * ANALYSTS.length)] ?? "",
      status: closed ? "closed" : "active",
      openDate: openDate.toISOString(),
      openPrice, price, target,
    });
  }
  return out.sort((a, b) => b.openDate.localeCompare(a.openDate));
})();
