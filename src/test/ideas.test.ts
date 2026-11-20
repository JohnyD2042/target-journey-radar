import { describe, it, expect } from "vitest";
import { flightUrl, isoLabel, moscowTime, STAGE_ZONE } from "@/lib/ideas";

describe("flight API", () => {
  it("shows Moscow time six hours ahead of Buenos Aires, independent of viewer timezone", () => {
    const prev = process.env["TZ"];
    process.env["TZ"] = "America/Argentina/Buenos_Aires";
    try {
      expect(moscowTime(Date.parse("2026-11-20T00:05:00-03:00"))).toBe("06:05");
      expect(moscowTime(Date.parse("2026-11-20T22:05:00Z"))).toBe("01:05");
    } finally {
      if (prev === undefined) delete process.env["TZ"];
      else process.env["TZ"] = prev;
    }
  });
  it("encodes analyst and ticker", () =>
    expect(flightUrl({ period: "month", book: "closed", analyst: "Финам & Co", ticker: "" })).toBe(
      "https://web-production-d1c75.up.railway.app/flight?period=month&book=closed&analyst=%D0%A4%D0%B8%D0%BD%D0%B0%D0%BC%20%26%20Co&ticker=",
    ));
  it("maps stages to the five zones", () =>
    expect(STAGE_ZONE).toEqual({ cold: 1, liftoff: 2, cruise: 3, approach: 4, landed: 5 }));
  it("shows the day the API sent, even for a viewer west of UTC", () => {
    const prev = process.env["TZ"];
    process.env["TZ"] = "America/Argentina/Buenos_Aires";
    try {
      expect(isoLabel("2026-11-04")).toBe("04.11.26");
      expect(isoLabel("2026-06-01")).toBe("01.06.26");
    } finally {
      if (prev === undefined) delete process.env["TZ"];
      else process.env["TZ"] = prev;
    }
  });
});
