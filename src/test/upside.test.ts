import { describe, expect, it } from "vitest";
import { byUpside } from "@/lib/ideas";

describe("upside filter", () => {
  it("0 keeps ideas without a target price", () => {
    expect(byUpside({ toTargetPct: null, noTarget: true }, 0)).toBe(true);
  });
  it("above 0 drops ideas without a target price", () => {
    expect(byUpside({ toTargetPct: null, noTarget: true }, 20)).toBe(false);
  });
  it("keeps ideas at or above the threshold only", () => {
    expect(byUpside({ toTargetPct: 50, noTarget: false }, 50)).toBe(true);
    expect(byUpside({ toTargetPct: 49.9, noTarget: false }, 50)).toBe(false);
  });
});
