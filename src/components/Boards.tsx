import { topClimbers, topPunctual } from "@/lib/boards";
import { ideaTitle, isLong, type Idea } from "@/lib/ideas";
import { Button } from "@/components/ui/button";

const pct = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d).replace(".", ",")}%`;
const share = (a: number, b: number) => `${((a / b) * 100).toFixed(1).replace(".", ",")}%`;

function Board({ title, sub, head, children }: { title: string; sub: string; head: string[]; children: React.ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border bg-card/60">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-3 py-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-[var(--z5)]">{title}</h2>
        <span className="font-mono text-[10px] text-muted-foreground">{sub}</span>
      </header>
      <div className={`grid ${head.length === 2 ? "grid-cols-[minmax(0,1fr)_88px]" : "grid-cols-[minmax(0,1fr)_auto_auto]"} gap-x-3 border-b px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground`}>
        {head.map((h, k) => <span key={h} className={k ? "text-right" : ""}>{h}</span>)}
      </div>
      <ol className="divide-y">{children}</ol>
    </section>
  );
}

export function Boards({ ideas, asOf, onPick }: { ideas: Idea[]; asOf: string; onPick: (i: Idea) => void }) {
  const climbers = topClimbers(ideas, asOf);
  const punctual = topPunctual(ideas);
  return (
    <div className="mx-4 mb-6 grid max-w-[1060px] items-start gap-4 md:mx-6 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <Board title="Бодрый старт" sub="Идеи за 30 дней с лучшей тягой" head={["Рейс / Идея", "Тяга, % / день"]}>
        {climbers.map(({ idea: i, perDay }) => (
          <li key={i.id}>
            <Button variant="ghost" onClick={() => onPick(i)} className="grid h-auto w-full grid-cols-[minmax(0,1fr)_88px] items-center gap-x-3 whitespace-normal rounded-none px-3 py-2.5 text-left font-normal hover:bg-muted/40">
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`w-4 shrink-0 text-center text-sm ${isLong(i) ? "text-long" : "text-short"}`} title={isLong(i) ? "Лонг" : "Шорт"} aria-label={isLong(i) ? "Лонг" : "Шорт"}>✈</span>
                  <span className="shrink-0 rounded border px-1 font-mono text-xs font-semibold">{i.ticker}</span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground" title={ideaTitle(i)}>{ideaTitle(i)}</span>
                </span>
                <span className="mt-1 block truncate pl-[22px] text-[11px] text-muted-foreground">{i.analyst}</span>
              </span>
              <span className="text-right font-mono text-sm font-semibold text-z5" title="Тяга = доходность идеи / количество дней с даты старта" aria-label={`Тяга ${pct(perDay, 2)} в день`}>
                {pct(perDay, 2)}
              </span>
            </Button>
          </li>
        ))}
        {climbers.length === 0 && <li className="px-4 py-6 text-xs text-muted-foreground">Пока нет свежих идей в плюсе</li>}
      </Board>
      <Board title="Пунктуальность аналитиков" sub="за всё время, > 3 идей" head={["Аналитик", "В плюсе", "Цель + посадка"]}>
        {punctual.map((p, k) => (
          <li key={p.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 px-4 py-2.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-4 shrink-0 font-mono text-[11px] text-muted-foreground">{k + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm">{p.name}</span>
                <span className="block font-mono text-[10px] text-muted-foreground">всего идей: {p.total}</span>
              </span>
            </span>
            <span className="text-right font-mono">
              <span className="block text-sm">{p.positive}<span className="text-muted-foreground"> / {p.total}</span></span>
              <span className="block text-[10px] text-muted-foreground">{share(p.positive, p.total)}</span>
            </span>
            <span className="text-right font-mono">
              <span className="block rounded bg-[var(--z5)]/15 px-2 py-0.5 text-sm font-semibold text-[var(--z5)]">{share(p.onTarget, p.total)}</span>
              <span className="block text-[10px] text-muted-foreground">{p.onTarget} идей</span>
            </span>
          </li>
        ))}
      </Board>
    </div>
  );
}
