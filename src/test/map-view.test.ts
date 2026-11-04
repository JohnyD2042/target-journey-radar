import { describe, expect, it } from "vitest";
import { constrainMapView, initialMapView, wheelMapView, zoomMapView } from "@/lib/map-view";

describe("flight map navigation", () => {
  it("allows horizontal and vertical pan even at 1:1", () => {
    expect(constrainMapView({ k: 1, x: 100, y: -80 }, 800, 500)).toEqual({ k: 1, x: 100, y: -80 });
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
