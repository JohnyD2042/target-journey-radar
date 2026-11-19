import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import type { Idea } from "@/lib/ideas";
import type { FeedEvent } from "@/lib/feed";

/** colour of the state badge at the right end of the line */
function statusTone(e: FeedEvent): string {
  const s = e.status ?? "";
  if (s === "закрыта по цели" || s === "цель") return "text-long";
  if (s === "на земле") return "text-short";
  return "text-muted-foreground";
}

/** one-line terminal ticker: switches event every 3.5 s, pauses under the pointer */
export function NewsTicker({ events, onIdea, onTicker }: { events: FeedEvent[]; onIdea: (i: Idea) => void; onTicker: (t: string) => void }) {
  const [n, setN] = useState(0);
  const paused = useRef(false);
  useEffect(() => {
    if (events.length < 2) return;
    const t = setInterval(() => { if (!paused.current) setN((v) => (v + 1) % events.length); }, 3500);
    return () => clearInterval(t);
  }, [events.length]);
  const e = events[n % Math.max(1, events.length)];
  if (!e) return null;
  const side = e.idea ? (e.idea.strategy === "шорт" ? "text-short" : "text-long") : "text-muted-foreground";
  // company name, analyst and what happened share the truncating middle; upside and state stay whole at the right end
  // the analyst is dropped on narrow screens so the name and the state never get cut
  const parts: { node: ReactNode; cls?: string }[] = [];
  if (e.name) parts.push({ node: <b className="font-semibold">{e.name}</b> });
  if (e.idea) parts.push({ node: <span className="text-muted-foreground">{e.idea.analyst}</span>, cls: "hidden min-[640px]:inline" });
  if (e.text) parts.push({ node: <span>{e.text}</span> });
  return (
    <button
      type="button"
      data-testid="news-ticker"
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
      onClick={() => (e.idea ? onIdea(e.idea) : e.ticker && onTicker(e.ticker))}
      className="mx-0 mb-2 flex h-9 w-full items-center gap-2 overflow-hidden border-y bg-card px-3 text-left font-mono text-xs transition-colors hover:border-primary min-[640px]:mx-2 min-[640px]:w-[calc(100%-1rem)] min-[640px]:rounded-md min-[640px]:border md:mx-4 md:w-[calc(100%-2rem)]"
    >
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-long" />
      <span key={e.id} className="feed-in flex min-w-0 flex-1 items-center gap-2">
        <span className={`shrink-0 ${side}`}>{e.idea ? "✈" : "◆"}</span>
        {e.idea && <span className={`shrink-0 font-semibold ${side}`}>{e.idea.strategy === "шорт" ? "ШОРТ" : "ЛОНГ"}</span>}
        <span className="min-w-0 flex-1 truncate text-foreground">
          {parts.map((p, k) => (
            <Fragment key={k}>
              {k > 0 && <span className={`text-muted-foreground ${parts[k]!.cls ?? ""}`}> · </span>}
              <span className={p.cls ?? ""}>{p.node}</span>
            </Fragment>
          ))}
        </span>
        {e.value && <span className={`shrink-0 ${e.idea && e.idea.yieldPct < 0 && e.kind !== "open" ? "text-short" : "text-long"}`}>{e.value}</span>}
        {e.status && <span className={`shrink-0 rounded-sm border px-1 text-[10px] uppercase ${statusTone(e)}`}>{e.status}</span>}
      </span>
    </button>
  );
}
