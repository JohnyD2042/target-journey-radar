export type MapView = { k: number; x: number; y: number };
export const initialMapView = (): MapView => ({ k: 1, x: 0, y: 0 });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** contentH: full plot height at zoom 1 — may exceed the visible height (losses sit below the first screen). */
export function constrainMapView(view: MapView, width: number, height: number, contentH = height): MapView {
  return {
    k: view.k,
    x: clamp(view.x, width * (1 - view.k), 0),
    y: clamp(view.y, height - contentH * view.k - height * 0.05, height * 0.05),
  };
}

export function zoomMapView(view: MapView, px: number, py: number, next: number): MapView {
  const k = clamp(next, 1, 10);
  const factor = k / view.k;
  return { k, x: px - (px - view.x) * factor, y: py - (py - view.y) * factor };
}

/** Two-finger pinch: zoom the starting view about the starting midpoint by d/d0, then follow the midpoint. */
export function pinchMapView(start: MapView, m0: { x: number; y: number }, d0: number, m: { x: number; y: number }, d: number): MapView {
  const z = zoomMapView(start, m0.x, m0.y, start.k * (d / Math.max(1, d0)));
  return { k: z.k, x: z.x + m.x - m0.x, y: z.y + m.y - m0.y };
}

export function wheelMapView(view: MapView, delta: { x: number; y: number; mode: number; pinch: boolean }, px: number, py: number): MapView {
  const unit = delta.mode === 1 ? 16 : delta.mode === 2 ? 100 : 1;
  return delta.pinch
    ? zoomMapView(view, px, py, view.k * Math.exp(-delta.y * unit * 0.002))
    : { ...view, x: view.x - delta.x * unit, y: view.y - delta.y * unit };
}
/** Screen-space slot for a zone header: the visible part of the band [from,to] (fractions of plot width), clipped to the plot. */
export function bandLabelSlot(from: number, to: number, pw: number, view: { k: number; x: number }) {
  const a = Math.max(0, from * pw * view.k + view.x);
  const b = Math.min(pw, to * pw * view.k + view.x);
  return { left: a, width: Math.max(0, b - a) };
}

/** True when a plain scroll could not move the map (already at its edge), so the page should scroll instead. */
export function wheelHitsEdge(before: MapView, after: MapView, pinch: boolean): boolean {
  return !pinch && Math.abs(after.x - before.x) < 0.5 && Math.abs(after.y - before.y) < 0.5;
}

/** Vertical scale: the first screen shows a little below 0 up to yMax; deeper losses continue below it. */
export function yScale(yMin: number, yMax: number, ph: number) {
  const bottom = yMax > 0 ? Math.max(yMin, -0.12 * yMax) : yMin;
  const k = ph / (yMax - bottom || 1);
  return { k, contentH: (yMax - yMin) * k };
}

/** Y range fitted to the ideas on screen: always includes 0, adds 10% headroom, spans at least 20 p.p., never exceeds the API range. */
export function fitYRange(yields: number[], apiMin: number, apiMax: number) {
  if (!yields.length) return { yMin: apiMin, yMax: apiMax };
  let lo = Math.min(0, ...yields), hi = Math.max(0, ...yields);
  const pad = (hi - lo) * 0.1;
  lo = lo < 0 ? lo - pad : 0; hi += pad;
  if (hi - lo < 20) hi = lo + 20;
  return { yMin: Math.max(apiMin, lo), yMax: Math.min(Math.max(apiMax, 0), hi) };
}
