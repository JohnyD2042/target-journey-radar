import { describe, it, expect } from "vitest";
import { flightUrl, STAGE_ZONE } from "@/lib/ideas";

describe("flight API", () => {
  it("encodes analyst and ticker", () =>
    expect(flightUrl({ period: "month", book: "closed", analyst: "Финам & Co", ticker: "" })).toBe(
      "https://web-production-d1c75.up.railway.app/flight?period=month&book=closed&analyst=%D0%A4%D0%B8%D0%BD%D0%B0%D0%BC%20%26%20Co&ticker=",
    ));
  it("maps stages to the five zones", () =>
    expect(STAGE_ZONE).toEqual({ cold: 1, liftoff: 2, cruise: 3, approach: 4, landed: 5 }));
});
