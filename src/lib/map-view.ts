export type MapView = { k: number; x: number; y: number };
export const initialMapView = (): MapView => ({ k: 1, x: 0, y: 0 });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function constrainMapView(view: MapView, width: number, height: number): MapView {
  return {
    k: view.k,
    x: clamp(view.x, width * (1 - view.k), 0),
    y: clamp(view.y, height * (1 - view.k) - height * 0.05, height * 0.05),
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
