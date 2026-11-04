export type MapView = { k: number; x: number; y: number };
export const initialMapView = (): MapView => ({ k: 1, x: 0, y: 0 });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function constrainMapView(view: MapView, width: number, height: number): MapView {
  return {
    k: view.k,
    x: clamp(view.x, width * (1 - view.k) - width * 0.65, width * 0.65),
    y: clamp(view.y, height * (1 - view.k) - height * 0.65, height * 0.65),
  };
}

export function zoomMapView(view: MapView, px: number, py: number, next: number): MapView {
  const k = clamp(next, 1, 10);
  const factor = k / view.k;
  return { k, x: px - (px - view.x) * factor, y: py - (py - view.y) * factor };
}

export function wheelMapView(view: MapView, delta: { x: number; y: number; mode: number; pinch: boolean }, px: number, py: number): MapView {
  const unit = delta.mode === 1 ? 16 : delta.mode === 2 ? 100 : 1;
  return delta.pinch
    ? zoomMapView(view, px, py, view.k * Math.exp(-delta.y * unit * 0.002))
    : { ...view, x: view.x - delta.x * unit, y: view.y - delta.y * unit };
}