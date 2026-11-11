import { describe, expect, it } from "vitest";
import { wheelHitsEdge, constrainMapView, initialMapView, wheelMapView, zoomMapView } from "@/lib/map-view";

describe("flight map navigation", () => {
  it("never pans past the map edges, so no empty space appears at the sides", () => {
    expect(constrainMapView({ k: 1, x: 100, y: -80 }, 800, 500)).toEqual({ k: 1, x: 0, y: -25 });
    expect(constrainMapView({ k: 2, x: -2000, y: 0 }, 800, 500).x).toBe(-800);
    expect(constrainMapView({ k: 2, x: 300, y: 0 }, 800, 500).x).toBe(0);
  });
  it("two-finger scrolling pans both axes without changing zoom", () => {
    expect(wheelMapView(initialMapView(), { x: 42, y: -28, mode: 0, pinch: false }, 400, 250)).toEqual({ k: 1, x: -42, y: 28 });
  });
  it("pinching preserves the coordinate under the cursor", () => {
    const before = { k: 2, x: -100, y: -50 };
    const after = wheelMapView(before, { x: 0, y: -20, mode: 0, pinch: true }, 300, 200);
    expect((300 - after.x) / after.k).toBeCloseTo((300 - before.x) / before.k);
    expect((200 - after.y) / after.k).toBeCloseTo((200 - before.y) / before.k);
  });
  it("reset restores scale and both offsets after panning at 1:1", () => {
    const moved = zoomMapView({ k: 3, x: -120, y: 50 }, 400, 250, 1);
    expect(moved).not.toEqual(initialMapView());
    expect(initialMapView()).toEqual({ k: 1, x: 0, y: 0 });
  });
});
import { bandLabelSlot } from "@/lib/map-view";
describe("bandLabelSlot", () => {
  it("keeps the label inside its band at 1:1", () => expect(bandLabelSlot(0.6, 0.87, 1000, { k: 1, x: 0 })).toEqual({ left: 600, width: 270 }));
  it("clips to the visible part when zoomed", () => expect(bandLabelSlot(0.6, 0.87, 1000, { k: 2, x: -1000 })).toEqual({ left: 200, width: 540 }));
  it("off-screen band gets zero width", () => expect(bandLabelSlot(0, 0.13, 1000, { k: 4, x: -2000 }).width).toBe(0));
});

import { pinchMapView as pinchMV } from "@/lib/map-view";
describe("pinchMapView", () => {
  it("spreading fingers to double distance doubles zoom around the midpoint", () => {
    const v = pinchMV({ k: 1, x: 0, y: 0 }, { x: 100, y: 50 }, 100, { x: 100, y: 50 }, 200);
    expect(v).toEqual({ k: 2, x: -100, y: -50 });
  });
  it("moving both fingers without spreading pans the map", () => {
    expect(pinchMV({ k: 2, x: -10, y: -10 }, { x: 0, y: 0 }, 80, { x: 30, y: 20 }, 80)).toEqual({ k: 2, x: 20, y: 10 });
  });
});

describe("wheelHitsEdge", () => {
  it("passes scroll to the page when the map cannot move", () => {
    expect(wheelHitsEdge({ k: 1, x: 0, y: 10 }, { k: 1, x: 0, y: 10 }, false)).toBe(true);
  });
  it("keeps scroll on the map while it still moves", () => {
    expect(wheelHitsEdge({ k: 1, x: 0, y: 0 }, { k: 1, x: 0, y: 8 }, false)).toBe(false);
  });
  it("never passes a pinch-zoom to the page", () => {
    expect(wheelHitsEdge({ k: 1, x: 0, y: 0 }, { k: 1, x: 0, y: 0 }, true)).toBe(false);
  });
});

import { fitYRange } from "@/lib/map-view";
describe("adaptive Y range", () => {
  it("fits filtered ideas from -10 to +30 instead of the full API range", () => {
    expect(fitYRange([-10, 5, 30], -60, 80)).toEqual({ yMin: -14, yMax: 34 });
  });
  it("keeps the zero line when all ideas are positive", () => {
    expect(fitYRange([10, 30], -60, 80).yMin).toBe(0);
  });
  it("spans at least 20 p.p. for a single idea", () => {
    expect(fitYRange([5], -60, 80)).toEqual({ yMin: 0, yMax: 20 });
  });
  it("never exceeds the API range", () => {
    expect(fitYRange([-60, 80], -60, 80)).toEqual({ yMin: -60, yMax: 80 });
  });
});
