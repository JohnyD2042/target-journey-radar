import { useEffect, useMemo, useRef, useState } from "react";
import { type Idea, type Zone, ZONES, ret, progress, upside, zoneOf } from "@/lib/ideas";
import { Button } from "@/components/ui/button";
import { constrainMapView, initialMapView, wheelMapView, zoomMapView, type MapView } from "@/lib/map-view";

const PAD = { l: 48, r: 12, t: 100, b: 40 };
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
  1: { rot: 6, ground: true },
  2: { rot: -32 },
  3: { rot: 0 },
  4: { rot: 18 },
  5: { rot: 0, ground: true },
};

/**
 * Header glyph: side-view outline airliner, one swept wing + one fin, nose +x.
 * Deliberately different from the filled top-down markers used on the map.
 */
const SIDE_FUSELAGE = "M6 17 L23 17 Q27 17 27 19 Q27 21 23 21 L6 21 Q2 21 2 19 Q2 17 6 17 Z";
const SIDE_WING = "M19 17 L12 4 L9 4 L13 17";
const SIDE_FIN = "M8 17 L4 9 L2 9 L4 17";

function ZoneGlyph({ rot, ground }: { rot: number; ground?: boolean }) {
  return (
    <svg viewBox="-3 0 33 26" className="!h-6 !w-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <g transform={`rotate(${rot} 15 19)`}>
        <path d={SIDE_FUSELAGE} />
        <path d={SIDE_WING} />
        <path d={SIDE_FIN} />
      </g>
      {ground && <line x1={1} x2={28} y1={23.5} y2={23.5} />}
    </svg>
  );
}

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

type Props = { ideas: Idea[]; onSelect: (i: Idea) => void; selectedId?: string | undefined; activeZone?: Zone | "notarget" | null; onZoneChange: (zone: Zone) => void };

export function FlightChart(props: Props) {
  // animated map is client-only: avoids SSR/hydration mismatch of per-frame values
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="map-bg h-full w-full rounded-xl border" />;
  return <FlightMap {...props} />;
}

function FlightMap({ ideas, onSelect, selectedId, activeZone, onZoneChange }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 480 });
  const [view, setView] = useState(initialMapView);
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
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pw = Math.max(1, size.w - PAD.l - PAD.r);
  const ph = Math.max(1, size.h - PAD.t - PAD.b);

  const updateView = (next: MapView) => {
    viewRef.current = constrainMapView(next, pw, ph);
    setView(viewRef.current);
    setHover(null);
  };
  const resetView = () => { viewRef.current = initialMapView(); setView(viewRef.current); setHover(null); };

  const zoomAt = (px: number, py: number, next: number) => {
    updateView(zoomMapView(viewRef.current, px, py, next));
  };

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      updateView(wheelMapView(viewRef.current, { x: e.deltaX, y: e.deltaY, mode: e.deltaMode, pinch: e.ctrlKey || e.metaKey }, e.clientX - rect.left - PAD.l, e.clientY - rect.top - PAD.t));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // reset zoom & replay take-off when dataset changes
  useEffect(() => { viewRef.current = initialMapView(); setView(viewRef.current); setLaunch(performance.now()); }, [ideas]);

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
        aria-label="Карта инвестиционных идей"
        data-map-view={`${view.k},${view.x},${view.y}`}
        style={{ cursor: "grab" }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) d.moved = true;
          if (d.moved) {
            e.currentTarget.setPointerCapture(e.pointerId);
            updateView({ k: viewRef.current.k, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y });
          }
        }}
        onPointerUp={() => setTimeout(() => (drag.current = null))}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => { if (!drag.current?.moved) drag.current = null; }}
      >
        <svg width={size.w} height={size.h} className="block">
          <defs>
            <clipPath id="plot"><rect x={0} y={0} width={pw} height={ph} /></clipPath>
            {/* zone band: zone colour strongest under its own label, fading toward the plot floor */}
            {[1, 2, 3, 4, 5].map((z) => (
              <linearGradient key={z} id={`band-${z}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={`var(--z${z})`} stopOpacity={z === 5 ? 0.42 : 0.34} />
                <stop offset="0.55" stopColor={`var(--z${z})`} stopOpacity={z === 5 ? 0.16 : 0.12} />
                <stop offset="1" stopColor={`var(--z${z})`} stopOpacity={0.07} />
              </linearGradient>
            ))}
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
                    fill={`url(#band-${b.z})`}
                  />
                  {/* each zone is opened by a line in its own colour */}
                  {b.from > 0 && (
                    <line x1={sx(b.from * pw)} x2={sx(b.from * pw)} y1={0} y2={ph} stroke={`var(--z${b.z})`} strokeOpacity={0.55} strokeDasharray={b.z === 5 ? "0" : "3 5"} strokeWidth={b.z === 5 ? 2 : 1} />
                  )}
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
            {sx(0.87 * pw) >= 0 && sx(0.87 * pw) <= pw && <Airport x={sx(0.87 * pw)} y={ph} label="" accent />}
            {sx(0.87 * pw) >= 0 && sx(0.87 * pw) <= pw && (
              <text x={sx(0.87 * pw)} y={ph + 30} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="var(--primary)">1X ЦЕЛЬ</text>
            )}
          </g>
        </svg>
      </div>

      <div className="absolute left-3 right-3 top-2 grid grid-cols-5 min-[640px]:left-12 min-[640px]:grid-cols-[13fr_14.8fr_44.4fr_14.8fr_13fr]" aria-label="Зоны и количество идей">
        {BANDS.map(({ z }) => {
          const icon = ZONE_ICON[z];
          const colorClass = { 1: "text-z1", 2: "text-z2", 3: "text-z3", 4: "text-z4", 5: "text-z5" }[z];
          return (
            <Button key={z} variant="ghost" aria-label={ZONES[z].name} aria-pressed={activeZone === z} onClick={() => onZoneChange(z)} className={`group h-[84px] min-w-0 flex-col gap-2 rounded-sm px-0.5 ${colorClass} ${activeZone === z ? "bg-accent" : ""}`}>
              <ZoneGlyph rot={icon.rot} ground={icon.ground} />
              <span className="flex min-h-10 max-w-full flex-col items-center justify-center gap-x-1.5 gap-y-1 min-[1024px]:min-h-8 min-[1024px]:flex-row">
                <span className="flex min-h-6 items-center whitespace-normal text-center text-[9px] font-semibold uppercase leading-tight min-[640px]:text-[10px]">{ZONES[z].name}</span>
                <span className="inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded border border-current/25 bg-background/50 px-1.5 font-mono text-[10px] font-medium leading-none text-muted-foreground transition-colors group-hover:border-current/50 group-hover:text-foreground">{ideas.filter((i) => zoneOf(i) === z).length}</span>
              </span>
            </Button>
          );
        })}
      </div>

      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2">
        <Button variant="ghost" className="map-btn" aria-label="Приблизить" title="Приблизить" onClick={() => zoomAt(pw / 2, ph / 2, viewRef.current.k * 1.6)}>+</Button>
        <Button variant="ghost" className="map-btn" aria-label="Отдалить" title="Отдалить" onClick={() => zoomAt(pw / 2, ph / 2, viewRef.current.k / 1.6)}>−</Button>
        <Button variant="ghost" className="map-btn text-[10px] disabled:opacity-40" aria-label="Сбросить" title="Исходный вид" disabled={view.k === 1 && view.x === 0 && view.y === 0} onClick={resetView}>1:1</Button>
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
                <span className="text-right">{fmt(upside(hover.idea) ?? 0)}</span>
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
