import { useEffect, useMemo, useRef, useState } from "react";
import { type Idea, type Zone, ZONES, ret, progress, upside, zoneOf } from "@/lib/ideas";

const PAD = { l: 48, r: 12, t: 34, b: 30 };
const BANDS: { z: Zone; from: number; to: number }[] = [
  { z: 1, from: 0, to: 0.13 },
  { z: 2, from: 0.13, to: 0.13 + 0.2 * 0.74 },
  { z: 3, from: 0.13 + 0.2 * 0.74, to: 0.13 + 0.8 * 0.74 },
  { z: 4, from: 0.13 + 0.8 * 0.74, to: 0.87 },
  { z: 5, from: 0.87, to: 1 },
];
const TICKS_X: [number, string][] = [[0, "0"], [0.2, "0,2x"], [0.5, "0,5x"], [0.8, "0,8x"]];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const fmt = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

function Plane({ color }: { color: string }) {
  return (
    <path
      d="M7 0 L1.5 -1.2 L-2 -6 L-3.4 -6 L-1.6 -1.2 L-5 -1 L-6.4 -3 L-7.4 -3 L-6.4 0 L-7.4 3 L-6.4 3 L-5 1 L-1.6 1.2 L-3.4 6 L-2 6 L1.5 1.2 Z"
      fill={color}
      stroke="var(--background)"
      strokeWidth={0.8}
    />
  );
}

export function FlightChart({ ideas, onSelect, selectedId }: { ideas: Idea[]; onSelect: (i: Idea) => void; selectedId?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 480 });
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<{ idea: Idea; x: number; y: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pw = size.w - PAD.l - PAD.r;
  const ph = size.h - PAD.t - PAD.b;

  const constrain = (v: { k: number; x: number; y: number }) => ({
    k: v.k,
    x: clamp(v.x, pw - pw * v.k, 0),
    y: clamp(v.y, ph - ph * v.k, 0),
  });

  const zoomAt = (px: number, py: number, next: number) => {
    const v = viewRef.current;
    const k = clamp(next, 1, 10);
    const f = k / v.k;
    setView(constrain({ k, x: px - (px - v.x) * f, y: py - (py - v.y) * f }));
  };

  useEffect(() => {
    const el = wrap.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(e.clientX - rect.left - PAD.l, e.clientY - rect.top - PAD.t, viewRef.current.k * Math.exp(-dy * 0.002));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // reset zoom when dataset changes
  useEffect(() => setView({ k: 1, x: 0, y: 0 }), [ideas]);

  const { yMin, yMax, minR } = useMemo(() => {
    const rs = ideas.map(ret);
    const lo = Math.min(0, ...rs), hi = Math.max(5, ...rs);
    const pad = (hi - lo) * 0.08 || 2;
    return { yMin: lo - pad, yMax: hi + pad, minR: Math.min(-0.01, ...rs) };
  }, [ideas]);

  const baseX = (i: Idea) => {
    const z = zoneOf(i);
    const r = ret(i), p = progress(i);
    let f: number;
    if (z === 1) f = 0.012 + (1 - r / minR) * 0.105;
    else if (z === 5) f = 0.89 + clamp((p - 1) / 0.2, 0, 1) * 0.09;
    else f = 0.13 + clamp(p, 0, 0.995) * 0.74;
    return f * pw;
  };
  const baseY = (r: number) => ((yMax - r) / (yMax - yMin)) * ph;
  const sx = (bx: number) => bx * view.k + view.x;
  const sy = (by: number) => by * view.k + view.y;

  // y ticks
  const yTicks = useMemo(() => {
    const visLo = yMax - ((ph - view.y) / view.k / ph) * (yMax - yMin);
    const visHi = yMax - ((-view.y) / view.k / ph) * (yMax - yMin);
    const span = (visHi - visLo) / 6;
    const mag = Math.pow(10, Math.floor(Math.log10(span)));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= span) ?? mag * 10;
    const out: number[] = [];
    for (let v = Math.ceil(visLo / step) * step; v <= visHi; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }, [yMin, yMax, ph, view]);

  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  return (
    <div className="relative h-full w-full select-none">
      <div
        ref={wrap}
        className="radar-bg absolute inset-0 overflow-hidden rounded-lg border touch-none"
        style={{ cursor: view.k > 1 ? "grab" : "default" }}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || view.k === 1) return;
          if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) d.moved = true;
          setView(constrain({ k: view.k, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
        }}
        onPointerUp={() => setTimeout(() => (drag.current = null))}
        onPointerLeave={() => (drag.current = null)}
      >
        <svg width={size.w} height={size.h} className="block">
          <defs>
            <clipPath id="plot"><rect x={0} y={0} width={pw} height={ph} /></clipPath>
          </defs>
          <g transform={`translate(${PAD.l},${PAD.t})`}>
            <g clipPath="url(#plot)">
              {BANDS.map((b) => (
                <g key={b.z}>
                  <rect
                    x={sx(b.from * pw)} y={0} width={(b.to - b.from) * pw * view.k} height={ph}
                    fill={`var(--z${b.z})`} opacity={b.z === 1 || b.z === 5 ? 0.1 : 0.04}
                  />
                  <line x1={sx(b.to * pw)} x2={sx(b.to * pw)} y1={0} y2={ph} stroke={`var(--z${b.z})`} strokeOpacity={0.35} strokeDasharray={b.z === 4 ? "0" : "3 4"} strokeWidth={b.z === 4 ? 2 : 1} />
                </g>
              ))}
              {yTicks.map((t) => (
                <line key={t} x1={0} x2={pw} y1={sy(baseY(t))} y2={sy(baseY(t))} stroke="var(--grid)" strokeWidth={t === 0 ? 0 : 1} />
              ))}
              {/* zero runway */}
              <line x1={0} x2={pw} y1={sy(baseY(0))} y2={sy(baseY(0))} stroke="var(--primary)" strokeWidth={1.5} strokeDasharray="10 6" opacity={0.8} />
              {/* flight path hint */}
              <path
                d={`M ${sx(0.13 * pw)} ${sy(baseY(0))} Q ${sx(0.5 * pw)} ${sy(baseY(0))} ${sx(0.87 * pw)} ${sy(baseY(yMax * 0.6))}`}
                fill="none" stroke="var(--foreground)" strokeOpacity={0.12} strokeWidth={1}
              />
              {ideas.map((i) => {
                const x = sx(baseX(i)), y = sy(baseY(ret(i)));
                const col = i.side === "long" ? "var(--long)" : "var(--short)";
                const sel = i.id === selectedId;
                return (
                  <g
                    key={i.id}
                    transform={`translate(${x},${y})`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHover({ idea: i, x: x + PAD.l, y: y + PAD.t })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => !drag.current?.moved && onSelect(i)}
                  >
                    <circle r={11} fill="transparent" />
                    {sel && <circle r={12} fill="none" stroke="var(--primary)" strokeWidth={1.5} />}
                    <circle r={9.5} fill={`var(--z${zoneOf(i)})`} opacity={0.18} />
                    <g opacity={i.status === "closed" ? 0.6 : 1}><Plane color={col} /></g>
                  </g>
                );
              })}
            </g>
            {/* zone headers */}
            {BANDS.map((b) => {
              const cx = sx(((b.from + b.to) / 2) * pw);
              if (cx < 0 || cx > pw) return null;
              return (
                <text key={b.z} x={cx} y={-14} textAnchor="middle" className="font-mono text-[10px] uppercase tracking-wider" fill={`var(--z${b.z})`}>
                  {size.w < 640 ? b.z : ZONES[b.z].name}
                </text>
              );
            })}
            {yTicks.map((t) => {
              const y = sy(baseY(t));
              if (y < 0 || y > ph) return null;
              return (
                <text key={t} x={-8} y={y + 3} textAnchor="end" className="font-mono text-[10px]" fill={t === 0 ? "var(--primary)" : "var(--muted-foreground)"}>
                  {t > 0 ? "+" : ""}{t}%
                </text>
              );
            })}
            {TICKS_X.map(([p, l]) => {
              const x = sx((0.13 + p * 0.74) * pw);
              if (x < 0 || x > pw) return null;
              return <text key={l} x={x} y={ph + 18} textAnchor="middle" className="font-mono text-[10px]" fill="var(--muted-foreground)">{l}</text>;
            })}
            {sx(0.87 * pw) <= pw && (
              <text x={sx(0.87 * pw)} y={ph + 18} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="var(--primary)">1X ЦЕЛЬ</text>
            )}
          </g>
        </svg>
      </div>

      <div className="absolute bottom-10 right-3 flex flex-col overflow-hidden rounded-md border bg-popover/90 font-mono text-sm backdrop-blur">
        <button className="h-8 w-8 hover:bg-accent" aria-label="Приблизить" onClick={() => zoomAt(pw / 2, ph / 2, view.k * 1.6)}>+</button>
        <button className="h-8 w-8 border-t hover:bg-accent" aria-label="Отдалить" onClick={() => zoomAt(pw / 2, ph / 2, view.k / 1.6)}>−</button>
        <button className="h-8 w-8 border-t text-[10px] hover:bg-accent disabled:opacity-40" aria-label="Сбросить" disabled={view.k === 1} onClick={() => setView({ k: 1, x: 0, y: 0 })}>1:1</button>
      </div>
      {view.k > 1 && (
        <div className="absolute left-14 top-10 rounded bg-popover/90 px-2 py-0.5 font-mono text-[10px] text-primary">×{view.k.toFixed(1)}</div>
      )}

      {hover && (
        <div
          className="pointer-events-none absolute z-10 w-56 rounded-md border bg-popover p-3 text-xs shadow-xl"
          style={{ left: clamp(hover.x + 14, 4, size.w - 230), top: clamp(hover.y - 20, 4, size.h - 140) }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold">{hover.idea.ticker}</span>
            <span className={`font-mono text-[10px] uppercase ${hover.idea.side === "long" ? "text-long" : "text-short"}`}>{hover.idea.side === "long" ? "лонг" : "шорт"}</span>
          </div>
          <div className="mt-0.5 text-muted-foreground">{hover.idea.analyst}</div>
          <div className="mt-2 grid grid-cols-2 gap-y-1 font-mono">
            <span className="text-muted-foreground">Доходность</span>
            <span className={`text-right ${ret(hover.idea) >= 0 ? "text-long" : "text-short"}`}>{fmt(ret(hover.idea))}</span>
            {hover.idea.status === "active" && hover.idea.target != null && (
              <>
                <span className="text-muted-foreground">Апсайд</span>
                <span className="text-right">{fmt(upside(hover.idea)!)}</span>
              </>
            )}
          </div>
          {hover.idea.status === "closed" && <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">● закрыта</div>}
          {hover.idea.target == null && <div className="mt-2 text-[10px] uppercase tracking-wider text-primary">идея без целевой цены</div>}
        </div>
      )}
    </div>
  );
}
