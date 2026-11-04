import { type Idea, progress, ret, upside } from "@/lib/ideas";

const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const x = (v: number) => `${v.toFixed(2).replace(".", ",")}x`;

/**
 * Flight progress bar: 0 → 1X target. Filled part = path already flown (the plane's X),
 * empty part = remaining upside. The x-label on the marker mirrors the map's X axis.
 */
export function IdeaPath({ idea: i }: { idea: Idea }) {
  const r = ret(i);
  const u = upside(i);
  const noTarget = i.target == null;
  const p = noTarget ? null : r < 0 ? 0 : Math.min(progress(i), 1);
  const reached = !noTarget && progress(i) >= 1;
  const fillCls = "bg-long";

  return (
    <div className="mt-5">
      <div className="relative h-1.5 rounded-full bg-muted">
        {[0.2, 0.5, 0.8].map((t) => (
          <span key={t} className="absolute top-0 h-full w-px bg-background/70" style={{ left: `${t * 100}%` }} />
        ))}
        {p != null && (
          <span className={`absolute inset-y-0 left-0 rounded-full ${fillCls}`} style={{ width: `${Math.max(p * 100, r < 0 ? 0 : 3)}%` }} />
        )}
        {p != null && (
          <span
            className="absolute -top-[18px] -translate-x-1/2 rounded bg-foreground px-1 font-mono text-[9px] font-semibold leading-[14px] text-background"
            style={{ left: `${Math.min(Math.max(p * 100, 8), 92)}%` }}
          >
            {x(r < 0 ? 0 : progress(i))}
          </span>
        )}
        {noTarget && <span className="absolute inset-0 rounded-full border border-dashed border-muted-foreground/50 bg-transparent" />}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span className={r >= 0 ? "text-long" : "text-short"}>{pct(r)}</span>
        <span>
          {noTarget ? "цели нет" : reached ? "цель 1X ✓" : u != null ? `апсайд ${pct(u)}` : ""}
        </span>
      </div>
    </div>
  );
}

export function SideTag({ idea: i }: { idea: Idea }) {
  return (
    <span className={`rounded border px-1 font-mono text-[9px] font-semibold uppercase leading-4 ${i.side === "long" ? "border-long/40 text-long" : "border-short/40 text-short"}`}>
      {i.side === "long" ? "лонг" : "шорт"}
    </span>
  );
}
