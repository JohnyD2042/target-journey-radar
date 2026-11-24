import { useRef } from "react";
import { ChartNoAxesColumn, Plane } from "lucide-react";
import { BOARD_ICONS } from "@/components/board-icons";
import type { Idea } from "@/lib/ideas";
import type { FeedEvent } from "@/lib/feed";
import { Button } from "@/components/ui/button";

/** Manual, single-line event capsules; touch scrolling stays native. */
export function NewsTicker({ events, onIdea, onTicker, onAnalyst }: { events: FeedEvent[]; onIdea: (i: Idea) => void; onTicker: (t: string) => void; onAnalyst: (name: string) => void }) {
  const gesture = useRef<{ id: number; x: number; left: number } | null>(null);
  const dragged = useRef(false);
  if (!events.length) return null;
  return (
    <div
      role="region"
      aria-label="Новости идей"
      className="news-capsules mx-2 mb-3 flex select-none gap-2 overflow-x-auto overscroll-x-contain py-1 md:mx-4"
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
        const Icon = e.idea ? Plane : e.kind === "hero" ? BOARD_ICONS.dark : e.kind === "predictable" ? BOARD_ICONS.predictable : e.kind === "punctual" ? BOARD_ICONS.punctual : ChartNoAxesColumn;
        const label = [e.idea?.strategy === "шорт" ? "ШОРТ" : undefined, e.name, e.idea?.analyst, e.text, e.value, e.status].filter(Boolean).join(" ");
        return (
          <Button
            key={e.id}
            variant="outline"
            type="button"
            data-testid="news-ticker"
            data-event-id={e.id}
            aria-label={label}
            title={label}
            onClick={() => { if (e.idea) onIdea(e.idea); else if (e.ticker) onTicker(e.ticker); else if (e.analyst) onAnalyst(e.analyst); }}
            className="h-12 min-w-0 shrink-0 min-w-[calc(100%-20px)] justify-start gap-1.5 rounded-full bg-card px-3 text-left font-mono text-[11px] hover:border-primary md:min-w-[calc((100%-28px)/2)] md:text-xs"
          >
            <span className={`grid size-7 shrink-0 place-items-center rounded-full bg-muted ${side}`}><Icon /></span>
            {e.idea?.strategy === "шорт" && <span className={`shrink-0 font-semibold ${side}`}>ШОРТ</span>}
            <span className="shrink-0 text-foreground">
              <span className="text-muted-foreground">{e.text}</span>
              {e.name && <>{" "}<b className="font-semibold">{e.name}</b></>}
            </span>
            {e.value && <span className={`shrink-0 ${e.idea && e.idea.yieldPct < 0 && e.kind !== "open" ? "text-short" : "text-long"}`}>
              {e.value}
            </span>}
            {e.status && <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] uppercase ${e.status === "целевая цена" ? "text-long" : "text-muted-foreground"}`}>{e.status}</span>}
          </Button>
        );
      })}
    </div>
  );
}
