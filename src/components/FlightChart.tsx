import { useEffect, useMemo, useRef, useState } from "react";
import { type Idea, type Zone, ZONES, ret, progress, upside, zoneOf } from "@/lib/ideas";

const PAD = { l: 48, r: 12, t: 46, b: 40 };
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
const hash = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** zone icon: top-down passenger airliner (Flightradar-style), nose +x */
const PLANE_D =
  "M10 0 C10 -0.9 9 -1.4 7.5 -1.4 L3 -1.4 L-1.5 -8.5 L-3.5 -8.5 L-1 -1.4 L-6 -1.3 L-8 -4 L-9.4 -4 L-8.4 0 L-9.4 4 L-8 4 L-6 1.3 L-1 1.4 L-3.5 8.5 L-1.5 8.5 L3 1.4 L7.5 1.4 C9 1.4 10 0.9 10 0 Z";
/** infographic glyph per zone: on ground / climbing / cruising / descending / parked */
const ZONE_ICON: Record<Zone, { rot: number; ground?: boolean }> = {
  1: { rot: 0, ground: true },
  2: { rot: -30 },
  3: { rot: 0 },
  4: { rot: 22 },
  5: { rot: 0, ground: true },
};

function Plane({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <path
        d="M10 0 C10 -0.9 9 -1.4 7.5 -1.4 L3 -1.4 L-1.5 -8.5 L-3.5 -8.5 L-1 -1.4 L-6 -1.3 L-8 -4 L-9.4 -4 L-8.4 0 L-9.4 4 L-8 4 L-6 1.3 L-1 1.4 L-3.5 8.5 L-1.5 8.5 L3 1.4 L7.5 1.4 C9 1.4 10 0.9 10 0 Z"
        fill={color}
        stroke="oklch(0.12 0.02 250)"
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
    </g>
  );
}

type Props = { ideas: Idea[]; onSelect: (i: Idea) => void; selectedId?: string | undefined };

export function FlightChart(props: Props) {
  // animated map is client-only: avoids SSR/hydration mismatch of per-frame values
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="map-bg h-full w-full rounded-xl border" />;
  return <FlightMap {...props} />;
}

function FlightMap({ ideas, onSelect, selectedId }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 480 });
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<{ idea: Idea; x: number; y: number } | null>(null);
  const [now, setNow] = useState(0);
  const [launch, setLaunch] = useState(0);
  const viewRef = useRef(view);
  viewRef.current = view;

  // animation clock
  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => { setNow(t); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
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

  // reset zoom & replay take-off when dataset changes
  useEffect(() => { setView({ k: 1, x: 0, y: 0 }); setLaunch(performance.now()); }, [ideas]);

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

  // airports
  const depX = sx(0.13 * pw), depY = sy(baseY(0));
  const arrX = sx(0.935 * pw), arrY = sy(baseY(yMax * 0.55));

  // per-plane animated state
  const planes = ideas.map((i) => {
    const h = hash(i.id);
    const z = zoneOf(i);
    const tx = sx(baseX(i)), ty = sy(baseY(ret(i)));
    const delay = (h % 600);
    const t = easeOut(clamp((now - launch - delay) / 1400, 0, 1));
    // fly-in from departure runway (zone 1 taxi in from runway too)
    let x = depX + (tx - depX) * t;
    let y = depY + (ty - depY) * t;
    // heading: toward target airport for flying, flat on ground, parked at gate
    let ang = Math.atan2(arrY - ty, arrX - tx) * 0.55;
    if (z === 1) ang = Math.PI * (h % 2 ? 0.02 : -0.02) + (ret(i) < -5 ? 0.25 : 0);
    if (z === 5) ang = -Math.PI / 2;
    if (t < 1) ang = Math.atan2(ty - depY, tx - depX || 1);
    // cruising wobble along heading (not on ground / gate)
    const moving = z !== 5 && i.status === "active";
    const ph2 = (h % 1000) / 1000 * Math.PI * 2;
    const amp = z === 1 ? 1.2 : 3;
    const wob = moving && t >= 1 ? Math.sin(now / 900 + ph2) * amp : 0;
    x += Math.cos(ang) * wob;
    y += Math.sin(ang) * wob + (moving && t >= 1 && z !== 1 ? Math.cos(now / 1300 + ph2) * 1.2 : 0);
    const trail = z === 1 ? 10 : z === 5 ? 0 : 18 + (z - 2) * 8;
    return { i, z, x, y, ang, trail, moving };
  });

  return (
    <div className="relative h-full w-full select-none">
      <div
        ref={wrap}
        className="map-bg absolute inset-0 overflow-hidden rounded-xl border touch-none"
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
            <linearGradient id="trail-long" x1="1" x2="0"><stop offset="0" stopColor="var(--long)" stopOpacity="0.7" /><stop offset="1" stopColor="var(--long)" stopOpacity="0" /></linearGradient>
            <linearGradient id="trail-short" x1="1" x2="0"><stop offset="0" stopColor="var(--short)" stopOpacity="0.7" /><stop offset="1" stopColor="var(--short)" stopOpacity="0" /></linearGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="2.2" /></filter>
          </defs>

          <g transform={`translate(${PAD.l},${PAD.t})`}>
            <g clipPath="url(#plot)">
              {BANDS.map((b) => (
                <g key={b.z}>
                  <rect
                    x={sx(b.from * pw)} y={0} width={(b.to - b.from) * pw * view.k} height={ph}
                    fill={`var(--z${b.z})`} opacity={b.z === 3 ? 0.07 : b.z === 5 ? 0.1 : 0.16}
                  />
                  <line x1={sx(b.to * pw)} x2={sx(b.to * pw)} y1={0} y2={ph} stroke={`var(--z${b.z})`} strokeOpacity={0.35} strokeDasharray={b.z === 4 ? "0" : "3 5"} strokeWidth={b.z === 4 ? 2 : 1} />
                </g>
              ))}
              {yTicks.map((t) => (
                <line key={t} x1={0} x2={pw} y1={sy(baseY(t))} y2={sy(baseY(t))} stroke="var(--grid)" strokeWidth={t === 0 ? 0 : 1} />
              ))}

              {/* zero axis: same color as other axes, just thicker */}
              <line x1={0} x2={pw} y1={depY} y2={depY} stroke="var(--grid)" strokeWidth={2.5} opacity={1} />

              <Airport x={depX} y={depY} label="СТАРТ" />

              {/* trails */}
              {planes.map(({ i, x, y, ang, trail }) => trail > 0 && (
                <line
                  key={`t${i.id}`}
                  x1={x - Math.cos(ang) * trail} y1={y - Math.sin(ang) * trail}
                  x2={x - Math.cos(ang) * 6} y2={y - Math.sin(ang) * 6}
                  stroke={`url(#trail-${i.side})`} strokeWidth={2} strokeLinecap="round"
                  gradientUnits="userSpaceOnUse"
                />
              ))}

              {/* planes */}
              {planes.map(({ i, z, x, y, ang }) => {
                const col = i.side === "long" ? "var(--long)" : "var(--short)";
                const sel = i.id === selectedId;
                const hov = hover?.idea.id === i.id;
                return (
                  <g
                    key={i.id}
                    transform={`translate(${x},${y})`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHover({ idea: i, x: x + PAD.l, y: y + PAD.t })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => !drag.current?.moved && onSelect(i)}
                  >
                    <circle r={14} fill="transparent" />
                    <circle r={11} fill={`var(--z${z})`} opacity={0.22} filter="url(#glow)" />
                    {sel && (
                      <>
                        <circle r={15} fill="none" stroke="var(--primary)" strokeWidth={1.5} />
                        <circle r={15} fill="none" stroke="var(--primary)" strokeWidth={1} className="ping" />
                      </>
                    )}
                    <g transform={`rotate(${(ang * 180) / Math.PI})`} opacity={i.status === "closed" ? 0.55 : 1}>
                      <Plane color={col} scale={sel || hov ? 1.25 : 1} />
                    </g>
                  </g>
                );
              })}
            </g>

            {BANDS.map((b) => {
              const cx = sx(((b.from + b.to) / 2) * pw);
              if (cx < 0 || cx > pw) return null;
              const icon = ZONE_ICON[b.z];
              return (
                <g key={b.z} transform={`translate(${cx},-24)`}>
                  <g transform={`translate(0,-2) rotate(${icon.rot})`} opacity={0.95}>
                    <path
                      d={PLANE_D}
                      fill={`var(--z${b.z})`}
                      stroke="oklch(0.12 0.02 250)"
                      strokeWidth={1}
                      strokeLinejoin="round"
                      transform="scale(0.72)"
                    />
                  </g>
                  {icon.ground && <line x1={-11} x2={11} y1={9} y2={9} stroke={`var(--z${b.z})`} strokeWidth={1} />}
                  <text y={20} textAnchor="middle" className="font-mono text-[10px] font-semibold uppercase tracking-wider" fill={`var(--z${b.z})`}>
                    {size.w < 640 ? b.z : ZONES[b.z].name}
                  </text>
                </g>
              );
            })}
            {yTicks.map((t) => {
              const y = sy(baseY(t));
              if (y < 0 || y > ph) return null;
              return (
                <text key={t} x={-8} y={y + 3} textAnchor="end" className="font-mono text-[10px]" fill="var(--muted-foreground)">
                  {t > 0 ? "+" : ""}{t}%
                </text>
              );
            })}
            {TICKS_X.map(([p, l]) => {
              const x = sx((0.13 + p * 0.74) * pw);
              if (x < 0 || x > pw) return null;
              return <text key={l} x={x} y={ph + 22} textAnchor="middle" className="font-mono text-[10px]" fill="var(--muted-foreground)">{l}</text>;
            })}
            {sx(0.87 * pw) <= pw && <Airport x={sx(0.87 * pw)} y={ph} label="" accent />}
            {sx(0.87 * pw) <= pw && (
              <text x={sx(0.87 * pw)} y={ph + 30} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="var(--primary)">1X ЦЕЛЬ</text>
            )}
          </g>
        </svg>
      </div>

      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2">
        <button className="map-btn" aria-label="Приблизить" onClick={() => zoomAt(pw / 2, ph / 2, view.k * 1.6)}>+</button>
        <button className="map-btn" aria-label="Отдалить" onClick={() => zoomAt(pw / 2, ph / 2, view.k / 1.6)}>−</button>
        <button className="map-btn text-[10px] disabled:opacity-40" aria-label="Сбросить" disabled={view.k === 1} onClick={() => setView({ k: 1, x: 0, y: 0 })}>1:1</button>
      </div>
      <div className="pointer-events-none absolute bottom-14 left-14 flex items-center gap-2 rounded bg-popover/80 px-2 py-0.5 font-mono text-[10px] backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-short" />
        <span className="text-primary">LIVE</span>
        <span className="text-muted-foreground">{ideas.length} в воздухе · ×{view.k.toFixed(1)}</span>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 w-56 rounded-md border bg-popover p-3 text-xs shadow-xl"
          style={{ left: clamp(hover.x + 16, 4, size.w - 230), top: clamp(hover.y - 20, 4, size.h - 140) }}
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

function Airport({ x, y, label, accent }: { x: number; y: number; label: string; accent?: boolean }) {
  const c = accent ? "var(--primary)" : "var(--z2)";
  return (
    <g transform={`translate(${x},${y})`} pointerEvents="none">
      <circle r={16} fill={c} opacity={0.12} className="ping-slow" />
      <circle r={7} fill="oklch(0.15 0.025 250)" stroke={c} strokeWidth={1.5} />
      <circle r={2.5} fill={c} />
      <text y={-12} textAnchor="middle" className="font-mono text-[9px] font-semibold tracking-widest" fill={c}>{label}</text>
    </g>
  );
}
