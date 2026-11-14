import { topClimbers, topPunctual } from "@/lib/boards";
import { ideaTitle, isLong, type Idea } from "@/lib/ideas";

const pct = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d).replace(".", ",")}%`;
const share = (a: number, b: number) => `${((a / b) * 100).toFixed(1).replace(".", ",")}%`;
const daysWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "день" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "дня" : "дней");

function Board({ title, sub, head, children }: { title: string; sub: string; head: string[]; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card/60">
      <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-[var(--z5)]">{title}</h2>
        <span className="font-mono text-[10px] text-muted-foreground">{sub}</span>
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 border-b px-4 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
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
    <div className="mx-4 mb-6 grid gap-4 md:mx-6 lg:grid-cols-2">
      <Board title="Набирают высоту" sub="старт ≤ 30 дней" head={["Рейс", "Доходность", "В день"]}>
        {climbers.map(({ idea: i, days, perDay }) => (
          <li key={i.id}>
            <button onClick={() => { onPick(i); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 px-4 py-2.5 text-left transition-colors hover:bg-muted/40">
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isLong(i) ? "bg-long" : "bg-short"}`} />
                  <span className="rounded border px-1.5 font-mono text-xs font-semibold">{i.ticker}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs">{ideaTitle(i)}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{i.analyst}</span>
              </span>
              <span className="text-right font-mono">
                <span className="block text-sm text-long">{pct(i.yieldPct)}</span>
                <span className="block text-[10px] text-muted-foreground">{days} {daysWord(days)}</span>
              </span>
              <span className="rounded bg-[var(--z5)]/15 px-2 py-1 text-right font-mono text-sm font-semibold text-[var(--z5)]">{pct(perDay, 2)}</span>
            </button>
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
