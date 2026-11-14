import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Idea, type Zone, ZONES, ZONE_STAGE, isBasket, isLong, liveInAir, zoneOf } from "@/lib/ideas";
const ret = (i: Idea) => i.yieldPct;
import { Button } from "@/components/ui/button";
import { yScale, constrainMapView, initialMapView, pinchMapView, wheelHitsEdge, wheelMapView, zoomMapView, type MapView } from "@/lib/map-view";
import { bandLabelSlot } from "@/lib/map-view";
import { BasketTag, IdeaPath, SideTag } from "@/components/IdeaPath";

// left strip carries the rotated "доходность" caption, bottom strip the "путь до целевой цены" one
const PAD = { l: 70, r: 12, t: 100, b: 54 };
// on a phone the caption is dropped: the left strip keeps only the Y ticks, so the map itself gets the screen
const PAD_SM = { l: 42, r: 8, t: 80, b: 54 };
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
const hash = (v: string | number) => { const s = String(v); let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** zone icon: top-down passenger airliner (Flightradar-style), nose +x */
const PLANE_D =
  "M10 0 C10 -0.9 9 -1.4 7.5 -1.4 L3 -1.4 L-1.5 -8.5 L-3.5 -8.5 L-1 -1.4 L-6 -1.3 L-8 -4 L-9.4 -4 L-8.4 0 L-9.4 4 L-8 4 L-6 1.3 L-1 1.4 L-3.5 8.5 L-1.5 8.5 L3 1.4 L7.5 1.4 C9 1.4 10 0.9 10 0 Z";
/** infographic glyph per zone: on the runway / climbing / cruising / descending / finished */
export const ZONE_ICON: Record<Zone, { rot: number; ground?: boolean; flag?: boolean }> = {
  1: { rot: 0, ground: true },
  2: { rot: -30 },
  3: { rot: -10 },
  4: { rot: 22 },
  5: { rot: 0, ground: true, flag: true },
};

/**
 * Header glyph: ONE continuous side-view outline of a passenger airliner — slender
 * fuselage with a tapered nose, tall swept fin above the tail, short flat stabilizer
 * just below it, one swept low wing under the belly. No fill, no ground line.
 * Deliberately different from the filled top-down markers used on the map.
 */
const SIDE_D =
  "M48 12.7 C46.5 10.6 42 9.2 36 9.2 L16 10 L7 1 L5 1 L9 10 L3 12.6 L6 14 L0 13 " +
  "L5 15.2 Q8 16 13 16 L20 16 L10 22 L14 23 L32 16 L36 16 C42 16 46.5 14.8 48 12.7 Z";

/** runway the parked airliner stands on, plus its wheels touching the pavement */
const RUNWAY_D = "M-2 24.4 H52 M40 16 V21.6 M24 19.1 V21.2";
const WHEELS: [number, number, number][] = [[40, 22.9, 1.5], [24, 22.6, 1.8]];

/** race marshal's checkered flag planted ahead of the parked airliner */
const FLAG_D = "M53 24.4 V-8 M53 -8 H68 V7 H53 Z";
const FLAG_CELLS: [number, number][] = [[53, -8], [63, -8], [58, -3], [53, 2], [63, 2]];

export function ZoneGlyph({
  rot,
  ground = false,
  flag = false,
  small = false,
}: {
  rot: number;
  ground?: boolean | undefined;
  flag?: boolean | undefined;
  small?: boolean | undefined;
}) {
  const box = flag ? "-4 -10 76 40" : ground ? "-4 -8 56 40" : "-3 -9 54 42";
  const width = flag ? (small ? "!w-10" : "!w-12") : small ? "!w-8" : "!w-10";
  return (
    <svg viewBox={box} className={`${small ? "!h-5" : "!h-6"} ${width}`} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <g transform={`rotate(${rot} 24 12.6)`}>
        <path d={SIDE_D} />
      </g>
      {ground && <path d={RUNWAY_D} strokeWidth={1.3} opacity={0.75} />}
      {ground &&
        WHEELS.map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />)}
      {flag && <path d={FLAG_D} strokeWidth={1.3} opacity={0.85} />}
      {flag &&
        FLAG_CELLS.map(([x, y]) => <rect key={`${x}:${y}`} x={x} y={y} width={5} height={5} fill="currentColor" stroke="none" />)}
    </svg>
  );
}


const Plane = memo(function Plane({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <path
        d={PLANE_D}
        fill={color}
        stroke="oklch(0.12 0.02 250)"
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
    </g>
  );
});

export const ZONE_TEXT: Record<Zone, string> = {
  1: "Идеи, которые на данный момент показывают отрицательную доходность.",
  2: "Перспективные идеи, которые уже начали приносить прибыль, но сохраняют более 80% потенциала.",
  3: "Идеи, которые показывают устойчивый положительный перформанс и сохраняют потенциал роста.",
  4: "Идеи, которые прошли более 0,8x своего потенциала и приближаются к целевой цене — приготовиться к фиксации прибыли.",
  5: "Идеи, закрытые по целевой цене. Зона помогает узнать имена лучших аналитиков и оценить перформанс идей.",
};

type Props = { ideas: Idea[]; yieldMin: number; yieldMax: number; zoneCounts: Record<string, number>; onSelect: (i: Idea) => void; onDeselect?: () => void; selectedId?: string | undefined; activeZone?: Zone | "notarget" | null; onZoneChange: (zone: Zone) => void };

export function FlightChart(props: Props) {
  // animated map is client-only: avoids SSR/hydration mismatch of per-frame values
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="map-bg h-full w-full rounded-xl border" />;
  return <FlightMap {...props} />;
}

function FlightMap({ ideas, yieldMin, yieldMax, zoneCounts, onSelect, onDeselect, selectedId, activeZone, onZoneChange }: Props) {
  const [help, setHelp] = useState<Zone | null>(null);
  const [helpHover, setHelpHover] = useState<Zone | null>(null);
  useEffect(() => {
    if (help == null) return;
    const close = () => setHelp(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [help]);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 480 });
  const [view, setView] = useState(initialMapView);
  const [hover, setHover] = useState<{ idea: Idea; x: number; y: number } | null>(null);
  // the tooltip grows when a portfolio's ticker string wraps: keep it inside the map
  const tip = useRef<HTMLDivElement>(null);
  const [tipH, setTipH] = useState(110);
  const [launch, setLaunch] = useState(0);
  const viewRef = useRef(view);
  viewRef.current = view;


  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // on a phone the legend is shorter, so the plot takes the freed strip at the top
  const mobile = size.w < 640;
  const pad = mobile ? PAD_SM : PAD;
  const pw = Math.max(1, size.w - pad.l - pad.r);
  const ph = Math.max(1, size.h - pad.t - pad.b);

  const updateView = (next: MapView) => {
    viewRef.current = constrainMapView(next, pw, ph, contentH);
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
      const rect = el.getBoundingClientRect();
      const pinch = e.ctrlKey || e.metaKey;
      const next = constrainMapView(wheelMapView(viewRef.current, { x: e.deltaX, y: e.deltaY, mode: e.deltaMode, pinch }, e.clientX - rect.left - pad.l, e.clientY - rect.top - pad.t), pw, ph, contentH);
      // map already at its edge: let the page scroll on, like any other page area
      if (wheelHitsEdge(viewRef.current, next, pinch)) return;
      e.preventDefault();
      updateView(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // reset zoom & replay take-off when dataset changes
  useEffect(() => { viewRef.current = initialMapView(); setView(viewRef.current); setLaunch(performance.now()); }, [ideas]);

  const { yMin, yMax, minR } = useMemo(() => {
    // vertical scale edges come from the API as is
    const span = yieldMax - yieldMin || 1;
    return { yMin: yieldMin, yMax: yieldMax === yieldMin ? yieldMin + span : yieldMax, minR: Math.min(-0.01, yieldMin) };
  }, [yieldMin, yieldMax]);

  const { k: yK, contentH } = yScale(yMin, yMax, ph);

  const baseX = (i: Idea) => {
    const z = zoneOf(i);
    const r = ret(i), p = i.capturedX;
    let f: number;
    if (z === 1) f = 0.012 + (1 - r / minR) * 0.105;
    else if (z === 5) f = 0.89 + clamp((p - 1) / 0.2, 0, 1) * 0.09;
    else f = 0.13 + clamp(p, 0, 0.995) * 0.74;
    return f * pw;
  };
  const baseY = (r: number) => (yMax - r) * yK;
  const sx = (bx: number) => bx * view.k + view.x;
  const sy = (by: number) => by * view.k + view.y;

  const yTicks = useMemo(() => {
    const visLo = yMax - (ph - view.y) / view.k / yK;
    const visHi = yMax - -view.y / view.k / yK;
    const span = (visHi - visLo) / 6;
    const mag = Math.pow(10, Math.floor(Math.log10(span)));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= span) ?? mag * 10;
    const out: number[] = [];
    for (let v = Math.ceil(visLo / step) * step; v <= visHi; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }, [yMin, yMax, ph, view, yK]);

  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; ly?: number } | null>(null);
  // active touch points + two-finger pinch state
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ start: MapView; m0: { x: number; y: number }; d0: number } | null>(null);
  const endPointer = (id: number) => {
    pts.current.delete(id);
    if (pts.current.size < 2) pinch.current = null;
    // pinch ended with one finger still down: continue dragging from where it is now, not from (0,0)
    const rest = [...pts.current.values()][0];
    if (rest && drag.current) drag.current = { x: rest.x, y: rest.y, vx: viewRef.current.x, vy: viewRef.current.y, moved: true, ly: rest.y };
  };

  // airports
  const depX = sx(0.13 * pw), depY = sy(baseY(0));
  const arrX = sx(0.935 * pw), arrY = sy(baseY(yMax * 0.55));

  // static per-plane resting geometry; recomputed only on data / pan / zoom / resize
  const targets = useMemo(() => ideas.map((i) => {
    const h = hash(i.id);
    const z = zoneOf(i);
    const tx = sx(baseX(i)), ty = sy(baseY(ret(i)));
    let ang = Math.atan2(arrY - ty, arrX - tx) * 0.55;
    if (z === 1) ang = Math.PI * (h % 2 ? 0.02 : -0.02) + (ret(i) < -5 ? 0.25 : 0);
    if (z === 5) ang = -Math.PI / 2;
    // active ideas always fly with an exhaust trail; closed ones are parked: static, no trail
    const moving = i.status === "active";
    if (moving && z === 5) ang = Math.atan2(arrY - ty, arrX - tx) * 0.55;
    return { key: String(i.id), tx, ty, ang, delay: h % 600, ph: ((h % 1000) / 1000) * Math.PI * 2, amp: z === 1 ? 1.5 : 3, bob: true, moving, trail: moving ? (z === 1 ? 14 : z === 5 ? 22 : 18 + (z - 2) * 8) : 0 };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ideas, view, pw, ph, yMin, yMax, minR]);

  // Animation runs outside React: one rAF loop mutates SVG attributes directly (~30fps),
  // so thousands of planes don't trigger a React re-render per frame.
  const nodes = useRef(new Map<string, { g: SVGGElement | null; r: SVGGElement | null; t: SVGLineElement | null; x: number; y: number }>());
  const anim = useRef({ targets, launch, depX, depY });
  anim.current = { targets, launch, depX, depY };
  const paint = (now: number) => {
    const { targets: ts, launch: l0, depX: dx, depY: dy } = anim.current;
    const still = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const p of ts) {
      const n = nodes.current.get(p.key);
      if (!n?.g) continue;
      const t = still ? 1 : easeOut(clamp((now - l0 - p.delay) / 1400, 0, 1));
      let x = dx + (p.tx - dx) * t, y = dy + (p.ty - dy) * t;
      const ang = t < 1 ? Math.atan2(p.ty - dy, p.tx - dx || 1) : p.ang;
      if (p.moving && t >= 1 && !still) {
        const wob = Math.sin(now / 900 + p.ph) * p.amp;
        x += Math.cos(ang) * wob;
        y += Math.sin(ang) * wob + (p.bob ? Math.cos(now / 1300 + p.ph) * 1.2 : 0);
      }
      n.x = x; n.y = y;
      n.g.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      n.r?.setAttribute("transform", `rotate(${((ang * 180) / Math.PI).toFixed(1)})`);
      if (n.t && p.trail > 0) {
        const c = Math.cos(ang), s2 = Math.sin(ang);
        n.t.setAttribute("x1", (x - c * p.trail).toFixed(1)); n.t.setAttribute("y1", (y - s2 * p.trail).toFixed(1));
        n.t.setAttribute("x2", (x - c * 6).toFixed(1)); n.t.setAttribute("y2", (y - s2 * 6).toFixed(1));
      }
    }
  };
  useLayoutEffect(() => paint(performance.now()));
  useLayoutEffect(() => { if (hover && tip.current) setTipH(tip.current.offsetHeight); }, [hover]);
  useEffect(() => {
    let raf = 0, last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || now - last < 33) return;
      last = now;
      paint(now);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const node = (key: string) => {
    let n = nodes.current.get(key);
    if (!n) { n = { g: null, r: null, t: null, x: 0, y: 0 }; nodes.current.set(key, n); }
    return n;
  };
  const live = liveInAir(ideas);

  return (
    <div className="relative h-full w-full select-none">
      <div
        ref={wrap}
        className="map-bg absolute inset-0 overflow-hidden min-[640px]:rounded-xl min-[640px]:border"
        aria-label="Карта инвестиционных идей"
        data-map-view={`${view.k},${view.x},${view.y}`}
        style={{ cursor: "grab", touchAction: view.k === 1 ? "pan-y" : "none" }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pts.current.size === 2) {
            const rect = e.currentTarget.getBoundingClientRect();
            const [a, b] = [...pts.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
            pinch.current = { start: viewRef.current, m0: { x: (a.x + b.x) / 2 - rect.left - pad.l, y: (a.y + b.y) / 2 - rect.top - pad.t }, d0: Math.hypot(a.x - b.x, a.y - b.y) };
            drag.current = { x: 0, y: 0, vx: 0, vy: 0, moved: true };
            return;
          }
          drag.current = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y, moved: false };
        }}
        onPointerMove={(e) => {
          if (pts.current.has(e.pointerId)) pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const pz = pinch.current;
          if (pz && pts.current.size >= 2) {
            const rect = e.currentTarget.getBoundingClientRect();
            const [a, b] = [...pts.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
            updateView(pinchMapView(pz.start, pz.m0, pz.d0, { x: (a.x + b.x) / 2 - rect.left - pad.l, y: (a.y + b.y) / 2 - rect.top - pad.t }, Math.hypot(a.x - b.x, a.y - b.y)));
            return;
          }
          const d = drag.current;
          if (!d) return;
          if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) d.moved = true;
          if (d.moved) {
            e.currentTarget.setPointerCapture(e.pointerId);
            const before = viewRef.current.y;
            updateView({ k: viewRef.current.k, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y });
            // finger drag hit the map's top/bottom edge: hand the rest of the motion to the page
            if (e.pointerType === "touch" && Math.abs(viewRef.current.y - before) < 0.5 && d.ly != null) window.scrollBy(0, d.ly - e.clientY);
            d.ly = e.clientY;
          }
        }}
        onPointerUp={(e) => { endPointer(e.pointerId); setTimeout(() => (drag.current = null)); }}
        onPointerCancel={(e) => { endPointer(e.pointerId); drag.current = null; }}
        onPointerLeave={() => { if (!drag.current?.moved) drag.current = null; }}
        onClick={() => { if (!drag.current?.moved) onDeselect?.(); }}
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
          </defs>

          <g transform={`translate(${pad.l},${pad.t})`}>
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
              {ideas.map((i, k) => targets[k]!.trail > 0 && (
                <line
                  key={`t${i.id}`}
                  ref={(el) => { node(String(i.id)).t = el; }}
                  stroke={`url(#trail-${isLong(i) ? "long" : "short"})`} strokeWidth={2} strokeLinecap="round"
                  gradientUnits="userSpaceOnUse"
                />
              ))}

              {/* planes */}
              {ideas.map((i) => {
                const z = zoneOf(i);
                const col = isLong(i) ? "var(--long)" : "var(--short)";
                const sel = String(i.id) === selectedId;
                const hov = hover?.idea.id === i.id;
                return (
                  <g
                    key={i.id}
                    ref={(el) => { node(String(i.id)).g = el; }}
                    className="cursor-pointer"
                    onPointerEnter={(e) => { const n = node(String(i.id)); if (e.pointerType === "mouse") setHover({ idea: i, x: n.x + pad.l, y: n.y + pad.t }); }}
                    onPointerLeave={() => setHover(null)}
                    onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) onSelect(i); }}
                  >
                    <circle r={14} fill="transparent" />
                    <circle r={10} fill={`var(--z${z})`} opacity={0.16} />
                    {sel && (
                      <>
                        <circle r={15} fill="none" stroke="var(--primary)" strokeWidth={1.5} />
                        <circle r={15} fill="none" stroke="var(--primary)" strokeWidth={1} className="ping" />
                      </>
                    )}
                    <g ref={(el) => { node(String(i.id)).r = el; }} opacity={i.status === "closed" ? 0.35 : 1} style={i.status === "closed" ? { filter: "saturate(0.3)" } : undefined}>
                      <Plane color={col} scale={(sel || hov ? 1.25 : 1) * (i.status === "closed" ? 0.85 : 1)} />
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
            {/* duplicate X ticks on the zero line so the scale is visible on the first screen */}
            {depY >= 0 && depY <= ph && TICKS_X.filter(([p]) => p > 0).map(([p, l]) => {
              const x = sx((0.13 + p * 0.74) * pw);
              if (x < 0 || x > pw) return null;
              return (
                <g key={`z${l}`}>
                  <line x1={x} x2={x} y1={depY - 5} y2={depY + 5} stroke="var(--muted-foreground)" strokeWidth={1.5} />
                  <text x={x} y={depY + 18} textAnchor="middle" className="font-mono text-[10px]" fill="var(--muted-foreground)">{l}</text>
                </g>
              );
            })}
            {sx(0.87 * pw) >= 0 && sx(0.87 * pw) <= pw && <Airport x={sx(0.87 * pw)} y={depY} label="" accent />}
            {sx(0.87 * pw) >= 0 && sx(0.87 * pw) <= pw && (
              <text x={sx(0.87 * pw)} y={depY + 30} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="var(--primary)">1X ЦЕЛЬ</text>
            )}

            {/* axis captions: quiet mono labels sitting in the padding, outside the plot itself.
                the Y one is dropped on a phone — there the strip is too narrow to spare for it */}
            {!mobile && (
              <text
                x={-pad.l + 13}
                y={ph / 2}
                transform={`rotate(-90 ${-pad.l + 13} ${ph / 2})`}
                textAnchor="middle"
                className="font-mono text-[9px] uppercase tracking-[0.18em]"
                fill="var(--muted-foreground)"
                opacity={0.7}
              >
                Доходность
              </text>
            )}
            <text
              x={pw / 2}
              y={ph + 42}
              textAnchor="middle"
              className="font-mono text-[9px] uppercase tracking-[0.18em]"
              fill="var(--muted-foreground)"
              opacity={0.7}
            >
              Путь до целевой цены
            </text>
          </g>
        </svg>
      </div>

      <div className="absolute top-2" style={{ left: pad.l, width: pw }} aria-label="Зоны и количество идей">
        {BANDS.map(({ z, from, to }) => {
          const slot = bandLabelSlot(from, to, pw, view);
          if (slot.width < 24) return null;
          const icon = ZONE_ICON[z];
          const colorClass = { 1: "text-z1", 2: "text-z2", 3: "text-z3", 4: "text-z4", 5: "text-z5" }[z];
          // narrow band: the name sits above its count so all five headers keep one and the same rhythm
          const tight = size.w < 640 || slot.width < 96;
          return (
            <div key={z} className="absolute" style={{ left: slot.left, width: slot.width }}>
            <Button variant="ghost" aria-label={ZONES[z].name} aria-pressed={activeZone === z} onClick={() => onZoneChange(z)} className={`group h-[66px] w-full min-w-0 flex-col items-center justify-between gap-1 overflow-visible rounded-sm px-px py-0.5 min-[640px]:h-[76px] min-[1024px]:h-[84px] min-[1024px]:py-2 ${colorClass} ${activeZone === z ? "bg-accent" : ""}`}>
              <ZoneGlyph rot={icon.rot} ground={icon.ground} flag={icon.flag} small={tight} />
              <span className={tight
                ? "flex w-full flex-col items-center justify-end gap-0.5 whitespace-normal text-center text-[8px] font-semibold uppercase leading-[1.15] tracking-[-0.02em] min-[640px]:text-[9px]"
                : "flex min-h-8 w-full flex-row items-center justify-center gap-1.5 whitespace-normal text-center text-[10px] font-semibold uppercase leading-tight"}>
                <span className="block max-w-full">{ZONES[z].name}</span>
                <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded border border-current/25 bg-background/50 px-1 font-mono text-[9px] font-medium leading-none text-muted-foreground transition-colors group-hover:border-current/50 group-hover:text-foreground min-[640px]:h-5 min-[640px]:min-w-6 min-[640px]:px-1.5 min-[640px]:text-[10px] min-[1024px]:min-w-7">{zoneCounts[ZONE_STAGE[z]] ?? 0}</span>
              </span>
            </Button>
            <button
              type="button"
              aria-label={`Что такое «${ZONES[z].name}»`}
              aria-expanded={help === z}
              onClick={(e) => { e.stopPropagation(); setHelp(help === z ? null : z); }}
              onMouseEnter={() => setHelpHover(z)}
              onMouseLeave={() => setHelpHover(null)}
              className="absolute -top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-current/40 bg-background/80 font-mono text-[9px] font-semibold leading-none opacity-70 transition-opacity hover:opacity-100 min-[640px]:h-[18px] min-[640px]:w-[18px] min-[640px]:text-[10px]"
              style={{ color: `var(--z${z})` }}
            >?</button>
            {(help === z || helpHover === z) && (
              <div
                role="tooltip"
                className={`absolute top-full z-30 mt-1 w-56 rounded-lg border bg-popover/95 p-2.5 text-left shadow-xl backdrop-blur ${z === 1 ? "left-0" : z === 5 ? "right-0" : "left-1/2 -translate-x-1/2"}`}
                style={{ borderColor: `var(--z${z})` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-[10px] font-semibold uppercase" style={{ color: `var(--z${z})` }}>{ZONES[z].name}</div>
                <p className="mt-1 text-[11px] normal-case leading-snug text-popover-foreground">{ZONE_TEXT[z]}</p>
                <div className="mt-1.5 text-[10px] text-muted-foreground">Нажмите на название зоны, чтобы показать только её идеи</div>
              </div>
            )}
            </div>
          );
        })}
      </div>

      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2">
        <Button variant="ghost" className="map-btn" aria-label="Приблизить" title="Приблизить" onClick={() => zoomAt(pw / 2, ph / 2, viewRef.current.k * 1.6)}>+</Button>
        <Button variant="ghost" className="map-btn" aria-label="Отдалить" title="Отдалить" onClick={() => zoomAt(pw / 2, ph / 2, viewRef.current.k / 1.6)}>−</Button>
        <Button variant="ghost" className="map-btn text-[10px] disabled:opacity-40" aria-label="Сбросить" title="Исходный вид" disabled={view.k === 1 && view.x === 0 && view.y === 0} onClick={resetView}>1:1</Button>
        <span className="map-btn pointer-events-none flex items-center justify-center font-mono text-[10px] text-muted-foreground" aria-label="Текущий масштаб">×{view.k.toFixed(1)}</span>
      </div>
      <div className="pointer-events-none absolute bottom-14 left-14 flex items-center gap-2 rounded bg-popover/80 px-2 py-0.5 font-mono text-[10px] backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-short" />
        <span className="text-primary">LIVE</span>
        <span className="text-muted-foreground">{live} в воздухе</span>
      </div>

      {hover && (
        <div
          ref={tip}
          className="pointer-events-none absolute z-10 w-48 rounded-lg border bg-popover/95 px-2.5 py-2 text-xs shadow-xl backdrop-blur"
          style={{ left: clamp(hover.x + 16, 4, size.w - 196), top: clamp(hover.y - 20, 4, size.h - tipH - 8) }}
        >
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="font-mono text-sm font-semibold leading-tight">{hover.idea.ticker}</span>
            <SideTag idea={hover.idea} />
            {isBasket(hover.idea) && <BasketTag />}
            {hover.idea.status === "closed" && <span className="ml-auto font-mono text-[9px] uppercase text-muted-foreground">закрыта</span>}
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">{hover.idea.analyst}</div>
          <IdeaPath idea={hover.idea} />
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
