import { useState } from "react";
import { ArrowUp, ChevronDown, ChevronUp, CircleGauge, Radar, ScanEye, Telescope } from "lucide-react";
import { topClimbers, topPunctual, topUpside, topDarkHorses, topPredictable } from "@/lib/boards";
import { ideaTitle, isLong, type Idea } from "@/lib/ideas";
import { Button } from "@/components/ui/button";
import { ZoneGlyph, ZONE_ICON } from "@/components/FlightChart";

const pct = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d).replace(".", ",")}%`;
const shareInt = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;
/** «1 день» / «2 дня» / «19 дней» */
const daysWord = (n: number) => {
  const t = n % 10, h = n % 100;
  if (t === 1 && h !== 11) return "день";
  if (t >= 2 && t <= 4 && (h < 10 || h >= 20)) return "дня";
  return "дней";
};
const ideaColumns = "grid-cols-[minmax(0,1fr)_58px_52px_60px] gap-x-2 sm:grid-cols-[minmax(0,215px)_1fr_1fr_1fr] sm:gap-x-4";
const upsideColumns = "grid-cols-[minmax(0,1fr)_92px_68px] gap-x-2.5";
const analystColumns = "grid-cols-[minmax(0,1fr)_72px_86px] gap-x-3 lg:gap-x-5";
const darkColumns = "grid-cols-[minmax(0,1fr)_46px_82px] gap-x-2.5";

const SHORT = 5;
const LONG = 10;

/** Same chevron as the map legend: flat when collapsed, flipped when the board is open. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Board({ title, sub, icon, cols, head, children, leftHead = false, className = "", more }: { title: string; sub: string; icon: React.ReactNode; cols: string; head: string[]; children: React.ReactNode; leftHead?: boolean; className?: string; more?: { open: boolean; total: number; onToggle: () => void } }) {
  const expandable = !!more && more.total > SHORT;
  return (
    <section className={`min-w-0 overflow-hidden rounded-lg border bg-card/60 ${className}`}>
      <header className="h-18 border-b">
        {expandable ? (
          <h2>
            <Button variant="ghost" onClick={more.onToggle} aria-expanded={more.open} className={`h-18 w-full flex-col items-start justify-center gap-1 whitespace-normal rounded-none px-3 py-0 text-left hover:bg-muted/40 ${more.open ? "bg-muted/20" : ""}`}>
              <span className="flex w-full items-center gap-1.5 font-mono text-sm font-semibold uppercase tracking-wider text-[var(--z5)]">
                <span className="shrink-0 opacity-80">{icon}</span>
                <span className="min-w-0 truncate">{title}</span>
                <span className="ml-auto pl-2"><Chevron open={more.open} /></span>
              </span>
              <span className="font-mono text-[10px] leading-tight text-muted-foreground">{sub}</span>
            </Button>
          </h2>
        ) : (
          <div className="flex h-18 flex-col items-start justify-center gap-1 px-3">
            <h2 className="flex items-center gap-1.5 font-mono text-sm font-semibold uppercase tracking-wider text-[var(--z5)]">
              <span className="shrink-0 opacity-80">{icon}</span>
              {title}
            </h2>
            <span className="font-mono text-[10px] leading-tight text-muted-foreground">{sub}</span>
          </div>
        )}
      </header>
      <div className={`grid h-9 items-center ${cols} border-b px-3 font-mono text-[9px] uppercase leading-tight tracking-wider text-muted-foreground`}>
        {head.map((h, k) => <span key={k} className={!leftHead && k ? "text-right" : ""}>{h}</span>)}
      </div>
      <ol className="divide-y">{children}</ol>
      {more && more.total > SHORT && (
        <Button variant="ghost" onClick={more.onToggle} aria-expanded={more.open} className="h-10 w-full gap-1.5 rounded-none border-t font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:bg-muted/40 hover:text-foreground">
          {more.open ? <><ChevronUp size={14} /> Свернуть до {SHORT} строк</> : <><ChevronDown size={14} /> Показать топ-{Math.min(LONG, more.total)}</>}
        </Button>
      )}
    </section>
  );
}

export function Boards({ ideas, asOf, onPick, onAnalystPick, onTickerPick }: { ideas: Idea[]; asOf: string; onPick: (i: Idea) => void; onAnalystPick: (name: string) => void; onTickerPick: (ticker: string) => void }) {
  const [open, setOpen] = useState({ climbers: false, upside: false, dark: false, kpd: false });
  const toggle = (k: keyof typeof open) => () => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const allClimbers = topClimbers(ideas, asOf, LONG);
  const punctual = topPunctual(ideas);
  const allUpside = topUpside(ideas, LONG);
  const allDark = topDarkHorses(ideas, asOf, LONG);
  const allKpd = topPredictable(ideas, LONG);
  const kpd = allKpd.slice(0, open.kpd ? LONG : SHORT);
  const climbers = allClimbers.slice(0, open.climbers ? LONG : SHORT);
  const upside = allUpside.slice(0, open.upside ? LONG : SHORT);
  const darkHorses = allDark.slice(0, open.dark ? LONG : SHORT);
  // Two independent columns on desktop: expanding a board only shifts the board below it.
  // On mobile the columns dissolve (contents) and order keeps the reading sequence.
  return (
    <div className="mx-4 mb-6 flex max-w-[1600px] flex-col gap-4 md:mx-6 md:grid md:grid-cols-2 md:items-start">
      <div className="contents md:flex md:min-w-0 md:flex-col md:gap-4">
      <Board
        className="order-1 md:order-none"
        more={{ open: open.climbers, total: allClimbers.length, onToggle: toggle("climbers") }}
        title="Бодрый старт"
        sub="Новые идеи, которые быстро набирают высоту"
        icon={<CircleGauge size={15} strokeWidth={1.75} />}
        cols={ideaColumns}
        head={["Идея", "Текущая прибыль", "Возраст", "Прибыль/день"]}
        leftHead
      >
        {climbers.map(({ idea: i, days, perDay }) => (
          <li key={i.id}>
            <Button variant="ghost" onClick={() => onPick(i)} className={`grid h-15 w-full ${ideaColumns} items-center whitespace-normal rounded-none px-3 py-2.5 text-left font-normal hover:bg-muted/40`}>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`w-4 shrink-0 text-center text-sm ${isLong(i) ? "text-long" : "text-short"}`} title={isLong(i) ? "Лонг" : "Шорт"} aria-label={isLong(i) ? "Лонг" : "Шорт"}>✈</span>
                  <span className="shrink-0 rounded border px-1 font-mono text-xs font-semibold">{i.ticker}</span>
                  <span className="min-w-0 truncate text-sm" title={ideaTitle(i)}>{ideaTitle(i)}</span>
                </span>
                <span className="mt-1 block truncate pl-[22px] text-[11px] text-muted-foreground">{i.analyst}</span>
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums text-z5" title="Текущая доходность идеи" aria-label={`Доходность ${pct(i.yieldPct)}`}>
                {pct(i.yieldPct)}
              </span>
              <span className="font-mono text-[11px] font-light tabular-nums text-muted-foreground" title="Возраст идеи: дней с даты старта" aria-label={`Идее ${days} ${daysWord(days)}`}>
                {days} {daysWord(days)}
              </span>
              <span className="font-mono text-sm font-medium tabular-nums text-foreground" title="Прибыль в день = доходность идеи / количество дней с даты старта" aria-label={`Прибыль в день ${pct(perDay, 2)}`}>
                {pct(perDay, 2)}
              </span>
            </Button>
          </li>
        ))}
        {climbers.length === 0 && <li className="px-4 py-6 text-xs text-muted-foreground">Пока нет свежих идей в плюсе</li>}
      </Board>
      <Board
        className="order-3 md:order-none"
        more={{ open: open.dark, total: allDark.length, onToggle: toggle("dark") }}
        title="Новые герои"
        sub="Новые имена и неожиданные возвращения"
        icon={<ScanEye size={15} strokeWidth={1.75} />}
        cols={darkColumns}
        head={["Актив", "Идей", "Ср. апсайд"]}
      >
        {darkHorses.map((asset) => (
          <li key={asset.ticker}>
            <Button variant="ghost" onClick={() => onTickerPick(asset.ticker)} aria-label={`Показать активные идеи ${asset.ticker}`} className={`grid h-15 w-full ${darkColumns} items-center whitespace-normal rounded-none px-3 py-2.5 text-left font-normal hover:bg-muted/40`}>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 rounded border px-1 font-mono text-xs font-semibold">{asset.ticker}</span>
                  <span className="min-w-0 truncate text-sm" title={asset.name}>{asset.name}</span>
                </span>
                <span className="mt-1 block truncate text-[11px] text-muted-foreground" title={asset.analysts.join(", ")}>{asset.analysts.join(", ")}</span>
              </span>
              <span className="text-right font-mono text-sm tabular-nums" title="Активные идеи, открытые за последние 60 дней">{asset.count}</span>
              <span className="text-right font-mono text-sm font-semibold text-z5" title="Средний апсайд активных идей с целевой ценой за последние 60 дней">{asset.averageUpside == null ? "—" : pct(asset.averageUpside, 0)}</span>
            </Button>
          </li>
        ))}
        {darkHorses.length === 0 && <li className="px-4 py-6 text-xs text-muted-foreground">Нет подходящих активов</li>}
      </Board>
      <Board
        className="order-4 md:order-none"
        more={{ open: open.kpd, total: allKpd.length, onToggle: toggle("kpd") }}
        title="КПД аналитики"
        sub="Активы, которые лучше всего поддаются прогнозированию"
        icon={<Telescope size={15} strokeWidth={1.75} />}
        cols={analystColumns}
        head={["Актив", "идей в плюсе", "Ср. прибыль"]}
      >
        {kpd.map((a) => (
          <li key={a.ticker}>
            <Button variant="ghost" onClick={() => onTickerPick(a.ticker)} aria-label={`Показать идеи ${a.ticker}`} className={`grid h-15 w-full ${analystColumns} items-center whitespace-normal rounded-none px-3 py-2.5 text-left font-normal hover:bg-muted/40`}>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 rounded border px-1 font-mono text-xs font-semibold">{a.ticker}</span>
                <span className="min-w-0 truncate text-sm" title={a.name}>{a.name}</span>
              </span>
              <span className="text-right font-mono">
                <span className="block text-sm" title="Доля идей с положительной доходностью">{shareInt(a.positive, a.total)}</span>
                <span className="block text-[10px] text-muted-foreground">{a.positive} / {a.total}</span>
              </span>
              <span className="text-right font-mono text-sm font-semibold text-z5" title="Средняя доходность всех идей по активу">{pct(a.averageYield)}</span>
            </Button>
          </li>
        ))}
        {kpd.length === 0 && <li className="px-4 py-6 text-xs text-muted-foreground">Нет подходящих активов</li>}
      </Board>
      </div>
      <div className="contents md:flex md:min-w-0 md:flex-col md:gap-4">
      <Board
        className="order-2 md:order-none"
        more={{ open: open.upside, total: allUpside.length, onToggle: toggle("upside") }}
        title="Максимальный апсайд"
        sub="Активные идеи с максимальным потенциалом роста"
        icon={<ArrowUp size={15} strokeWidth={1.75} />}
        cols={upsideColumns}
        head={["Идея", "Фаза", "Апсайд"]}
      >
        {upside.map((i) => {
          const z = i.stage === "liftoff" ? 2 : 3;
          return (
            <li key={i.id}>
              <Button variant="ghost" onClick={() => onPick(i)} className={`grid h-15 w-full ${upsideColumns} items-center whitespace-normal rounded-none px-3 py-2.5 text-left font-normal hover:bg-muted/40`}>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={`w-4 shrink-0 text-center text-sm ${isLong(i) ? "text-long" : "text-short"}`} aria-label={isLong(i) ? "Лонг" : "Шорт"}>✈</span>
                    <span className="shrink-0 rounded border px-1 font-mono text-xs font-semibold">{i.ticker}</span>
                    <span className="min-w-0 truncate text-sm" title={ideaTitle(i)}>{ideaTitle(i)}</span>
                  </span>
                  <span className="mt-1 block truncate pl-[22px] text-[11px] text-muted-foreground">{i.analyst}</span>
                </span>
                <span className="flex items-center justify-end gap-1 font-mono text-[11px]" style={{ color: `var(--z${z})` }}>
                  <ZoneGlyph rot={ZONE_ICON[z].rot} small /> {z === 2 ? "Взлёт" : "В полёте"}
                </span>
                <span className="text-right font-mono text-sm font-semibold text-z5">{pct(i.toTargetPct ?? 0, 0)}</span>
              </Button>
            </li>
          );
        })}
        {upside.length === 0 && <li className="px-4 py-6 text-xs text-muted-foreground">Нет подходящих идей</li>}
      </Board>
      <Board
        className="order-5 md:order-none"
        title="Пунктуальность аналитиков"
        sub="Точность прогнозов за всё время"
        icon={<Radar size={15} strokeWidth={1.75} />}
        cols={analystColumns}
        head={["Аналитик", "идей в плюсе", "цель или почти"]}
      >
        {punctual.map((p, k) => (
          <li key={p.name}>
            <Button variant="ghost" onClick={() => onAnalystPick(p.name)} aria-label={`Показать идеи аналитика ${p.name}`} className={`grid h-15 w-full ${analystColumns} items-center whitespace-normal rounded-none px-3 py-2.5 text-left font-normal hover:bg-muted/40`}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-4 shrink-0 font-mono text-[11px] text-muted-foreground">{k + 1}</span>
              <span className="min-w-0 truncate py-1 text-sm" title={p.name}>{p.name}</span>
            </span>
            <span className="text-right font-mono">
              <span className="flex items-center justify-end gap-1 text-sm" title="Доля идей с положительной доходностью">
                <ZoneGlyph rot={-30} small /> {shareInt(p.positive, p.total)}
              </span>
              <span className="block text-[10px] text-muted-foreground">{p.positive} / {p.total}</span>
            </span>
            <span className="text-right font-mono">
              <span className="flex items-center justify-end gap-1 text-sm font-semibold text-[var(--z5)]" title="Доля идей, достигших цели или на посадке">
                <ZoneGlyph rot={0} ground flag small /> {shareInt(p.onTarget, p.total)}
              </span>
              <span className="block text-[10px] text-muted-foreground">{p.onTarget} / {p.total}</span>
            </span>
            </Button>
          </li>
        ))}
      </Board>
      </div>
    </div>
  );
}
