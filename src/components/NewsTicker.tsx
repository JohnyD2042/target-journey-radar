import { useEffect, useRef, useState } from "react";
import type { Idea } from "@/lib/ideas";
import type { FeedEvent } from "@/lib/feed";

const TAG: Record<FeedEvent["kind"], string> = {
  open: "ВЗЛЁТ", close: "ЗАКРЫТА", target: "ЦЕЛЬ", approach: "ПОСАДКА", win: "РЕКОРД", loss: "УБЫТОК", hero: "ГЕРОЙ", stat: "ПОТОК",
};

/** one-line terminal ticker: switches event every 2 s, pauses under the pointer */
export function NewsTicker({ events, onIdea, onTicker }: { events: FeedEvent[]; onIdea: (i: Idea) => void; onTicker: (t: string) => void }) {
  const [n, setN] = useState(0);
  const paused = useRef(false);
  useEffect(() => {
    if (events.length < 2) return;
    const t = setInterval(() => { if (!paused.current) setN((v) => (v + 1) % events.length); }, 2000);
    return () => clearInterval(t);
  }, [events.length]);
  const e = events[n % Math.max(1, events.length)];
  if (!e) return null;
  const side = e.idea ? (e.idea.strategy === "шорт" ? "text-short" : "text-long") : "text-muted-foreground";
  return (
    <button
      type="button"
      data-testid="news-ticker"
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
      onClick={() => (e.idea ? onIdea(e.idea) : e.ticker && onTicker(e.ticker))}
      className="mx-0 mb-2 flex h-9 w-full items-center gap-2 overflow-hidden border-y bg-card px-3 text-left font-mono text-xs transition-colors hover:border-primary min-[640px]:mx-2 min-[640px]:w-[calc(100%-1rem)] min-[640px]:rounded-md min-[640px]:border md:mx-4 md:w-[calc(100%-2rem)]"
    >
      <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-long" />
        {n % events.length + 1}/{events.length}
      </span>
      <span key={e.id} className="feed-in flex min-w-0 flex-1 items-center gap-2">
        <span className={`shrink-0 ${side}`}>{e.idea ? "✈" : "◆"}</span>
        <span className="shrink-0 rounded-sm border px-1 text-[10px] text-muted-foreground">{TAG[e.kind]}</span>
        <span className="truncate text-foreground">{e.text}</span>
      </span>
    </button>
  );
}
