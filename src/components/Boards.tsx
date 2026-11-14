import { topClimbers, topPunctual, thrustEngines } from "@/lib/boards";
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
      <Board title="Бодрый старт" sub="Идеи за 30 дней с лучшей тягой" head={["Рейс / Идея", "Тяга"]}>
        {climbers.map(({ idea: i, perDay }) => (
          <li key={i.id}>
            <Button variant="ghost" onClick={() => onPick(i)} className="grid h-auto w-full grid-cols-[minmax(0,1fr)_88px] items-center gap-x-3 whitespace-normal rounded-none px-3 py-2.5 text-left font-normal hover:bg-muted/40">
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isLong(i) ? "bg-long" : "bg-short"}`} />
                  <span className="shrink-0 rounded border px-1 font-mono text-xs font-semibold">{i.ticker}</span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground" title={ideaTitle(i)}>{ideaTitle(i)}</span>
                </span>
                <span className="mt-1 block truncate pl-3 text-[11px] text-muted-foreground">{i.analyst}</span>
              </span>
              <span className="flex flex-wrap justify-end gap-1 text-z5" title={`Тяга: ${pct(perDay, 2)} в день · ${thrustEngines(perDay)} двигателей`} aria-label={`Тяга ${pct(perDay, 2)} в день, двигателей: ${thrustEngines(perDay)}`}>
                {Array.from({ length: thrustEngines(perDay) }, (_, k) => (
                  <svg key={k} viewBox="0 0 24 24" className="!h-4 !w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M8 5h9l3 3v8l-3 3H8zM8 5C3 5 3 19 8 19M17 6v12M4 9H1m3 3H0m4 3H1" strokeLinejoin="round" strokeLinecap="round" />
                    <ellipse cx="8" cy="12" rx="2.5" ry="5" />
                    <path d="M8 9v6m-1.5-3h3" />
                  </svg>
                ))}
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
