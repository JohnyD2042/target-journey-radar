import { type Idea, isLong } from "@/lib/ideas";

const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const x = (v: number) => `${v.toFixed(2).replace(".", ",")}x`;

/** Flight progress bar 0 → 1X, driven by the API's capturedX. */
export function IdeaPath({ idea: i }: { idea: Idea }) {
  const r = i.yieldPct;
  const p = i.noTarget ? null : Math.max(0, Math.min(i.capturedX, 1));
  const reached = !i.noTarget && i.capturedX >= 1;

  return (
    <div className="mt-5">
      <div className="relative h-1.5 rounded-full bg-muted">
        {[0.2, 0.5, 0.8].map((t) => (
          <span key={t} className="absolute top-0 h-full w-px bg-background/70" style={{ left: `${t * 100}%` }} />
        ))}
        {p != null && (
          <span className="absolute inset-y-0 left-0 rounded-full bg-long" style={{ width: `${p > 0 ? Math.max(p * 100, 3) : 0}%` }} />
        )}
        {p != null && (
          <span
            className="absolute -top-[18px] -translate-x-1/2 rounded bg-foreground px-1 font-mono text-[9px] font-semibold leading-[14px] text-background"
            style={{ left: `${Math.min(Math.max(p * 100, 8), 92)}%` }}
          >
            {x(i.capturedX)}
          </span>
        )}
        {i.noTarget && <span className="absolute inset-0 rounded-full border border-dashed border-muted-foreground/50 bg-transparent" />}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span className={r >= 0 ? "text-long" : "text-short"}>{pct(r)}</span>
        <span>
          {i.noTarget ? "цели нет" : reached ? "цель 1X ✓" : i.toTargetPct != null ? `апсайд ${pct(i.toTargetPct)}` : ""}
        </span>
      </div>
    </div>
  );
}

export function SideTag({ idea: i }: { idea: Idea }) {
  return (
    <span className={`rounded border px-1 font-mono text-[9px] font-semibold uppercase leading-4 ${isLong(i) ? "border-long/40 text-long" : "border-short/40 text-short"}`}>
      {i.strategy}
    </span>
  );
}
