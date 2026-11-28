import { useEffect, useRef, useState } from "react";
import { ChartNoAxesColumn, ChevronRight } from "lucide-react";
import { BOARD_ICONS, IDEA_ICON } from "@/components/board-icons";
import type { Idea, Period } from "@/lib/ideas";
import type { FeedEvent } from "@/lib/feed";
import { Button } from "@/components/ui/button";

/** Manual, single-line event capsules; touch scrolling stays native. */
export function NewsTicker({ events, onIdea, onTicker, onAnalyst, onWeek }: { events: FeedEvent[]; onIdea: (i: Idea) => void; onTicker: (t: string, period?: Period) => void; onAnalyst: (name: string, period?: Period) => void; onWeek: () => void }) {
  const gesture = useRef<{ id: number; x: number; left: number } | null>(null);
  const dragged = useRef(false);
  const strip = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const update = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : undefined;
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", update); ro?.disconnect(); };
  }, [events]);
  if (!events.length) return null;
  return (
    <div className="relative mx-2 mb-2 md:mx-4">
    <div
      ref={strip}
      role="region"
      aria-label="Новости идей"
      className="news-capsules flex select-none gap-1.5 overflow-x-auto overscroll-x-contain py-0.5 pr-10"
      onPointerDown={(event) => {
        dragged.current = false;
        if (event.pointerType !== "mouse" || event.button !== 0) return;
        gesture.current = { id: event.pointerId, x: event.clientX, left: event.currentTarget.scrollLeft };
      }}
      onPointerMove={(event) => {
        const start = gesture.current;
        if (!start || event.pointerId !== start.id) return;
        const distance = event.clientX - start.x;
        if (!dragged.current && Math.abs(distance) < 6) return;
        dragged.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.scrollLeft = start.left - distance;
        event.preventDefault();
      }}
      onPointerUp={(event) => {
        gesture.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { gesture.current = null; }}
      onClickCapture={(event) => {
        if (dragged.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); }
      }}
    >
      {events.map((e) => {
        const side = e.idea ? (e.idea.strategy === "шорт" ? "text-short" : "text-long") : "text-primary";
        const Icon = e.idea ? IDEA_ICON : e.kind === "hero" ? BOARD_ICONS.dark : e.kind === "predictable" ? BOARD_ICONS.predictable : e.kind === "punctual" ? BOARD_ICONS.punctual : ChartNoAxesColumn;
        const name = e.name?.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("ru-RU"));
        const label = [e.idea?.strategy === "шорт" ? "ШОРТ" : undefined, name, e.idea?.analyst, e.text, e.value, e.status].filter(Boolean).join(" ");
        return (
          <Button
            key={e.id}
            variant="outline"
            type="button"
            data-testid="news-ticker"
            data-event-id={e.id}
            aria-label={label}
            title={label}
            onClick={() => { if (e.idea) onIdea(e.idea); else if (e.ticker) onTicker(e.ticker, e.period ?? "all"); else if (e.analyst) onAnalyst(e.analyst, e.period ?? "all"); else if (e.period === "week") onWeek(); }}
            className="h-8 w-auto shrink-0 justify-start gap-1.5 rounded-full bg-card py-1 pl-1 pr-2.5 text-left font-mono text-[11px] hover:border-primary"
          >
            <span className={`grid size-[22px] shrink-0 place-items-center rounded-full bg-muted ${side} [&_svg]:size-3.5`}><Icon /></span>
            {e.idea?.strategy === "шорт" && <span className={`shrink-0 font-semibold ${side}`}>ШОРТ</span>}
            {name && <b className="shrink-0 font-semibold text-foreground">{name}</b>}
            <span className="shrink-0 text-muted-foreground">{e.text}</span>
            {e.value && <span className={`shrink-0 ${e.idea && e.idea.yieldPct < 0 && e.kind !== "open" ? "text-short" : "text-long"}`}>
              {e.value}
            </span>}
            {e.status && <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] uppercase ${e.status === "целевая цена" ? "text-long" : "text-muted-foreground"}`}>{e.status}</span>}
          </Button>
        );
      })}
    </div>
    {more && (
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-14 items-center justify-end bg-linear-to-l from-background via-background/80 to-transparent">
        <button
          type="button"
          aria-label="Прокрутить новости вправо"
          onClick={() => strip.current?.scrollBy({ left: 300, behavior: "smooth" })}
          className="pointer-events-auto grid size-7 place-items-center rounded-full border bg-card text-muted-foreground hover:border-primary hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    )}
    </div>
  );
}
