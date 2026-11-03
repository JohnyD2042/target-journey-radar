import { describe, it, expect } from "vitest";
import { zoneOf, type Idea } from "@/lib/ideas";

const base: Idea = { id: "x", ticker: "T", name: "T", analyst: "A", side: "long", status: "active", openDate: "2026-07-01", openPrice: 100, price: 100, target: 120 };

describe("zoneOf", () => {
  it("negative return -> zone 1", () => expect(zoneOf({ ...base, price: 95 })).toBe(1));
  it("under 0.2x -> zone 2", () => expect(zoneOf({ ...base, price: 103 })).toBe(2));
  it("0.5x -> zone 3", () => expect(zoneOf({ ...base, price: 110 })).toBe(3));
  it("active at target stays in zone 4", () => expect(zoneOf({ ...base, price: 125 })).toBe(4));
  it("closed at target -> zone 5", () => expect(zoneOf({ ...base, price: 120, status: "closed" })).toBe(5));
  it("no target with plus -> zone 3", () => expect(zoneOf({ ...base, target: null, price: 140 })).toBe(3));
  it("no target with minus -> zone 1", () => expect(zoneOf({ ...base, target: null, price: 90 })).toBe(1));
});
