import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Idea } from "@/lib/ideas";
import { Route } from "@/routes/index";

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: (data: unknown) => data,
  useQuery: () => ({ data: flight, isError: false, isFetching: false, dataUpdatedAt: 1 }),
}));
vi.mock("@/components/FlightChart", () => ({
  FlightChart: ({ ideas, onSelect }: { ideas: Idea[]; onSelect: (idea: Idea) => void }) => (
    <div data-testid="map-ideas">
      {ideas.map((idea) => <button key={idea.id} onClick={() => onSelect(idea)}>Самолёт {idea.id}</button>)}
    </div>
  ),
  ZoneGlyph: () => null,
  ZONE_ICON: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
  ZONE_TEXT: {},
}));
vi.mock("@/components/Boards", () => ({ Boards: () => null }));
vi.mock("@/components/IdeaPath", () => ({ IdeaPath: () => null, BasketTag: () => null, SideTag: () => null }));

const idea = (id: number, status: Idea["status"], ticker = "CHMF"): Idea => ({
  id, ticker, status, name: ticker, analyst: "A", strategy: "лонг", openedLabel: "",
  start: 100, current: 110, target: 120, yieldPct: 10, toTargetPct: 9,
  noTarget: false, capturedX: 0.5, stage: "cruise",
});
const flight = {
  asOf: "2026-11-17", yieldMin: -50, yieldMax: 100,
  ideas: [idea(1, "active"), idea(2, "closed"), idea(3, "active", "SBER")],
};

describe("Другие идеи", () => {
  it("shows all and only T ideas after opening its news event", () => {
    const previous = flight.ideas;
    flight.ideas = [{ ...idea(1, "active", "T"), yieldPct: 35 }, idea(2, "closed", "T"), idea(3, "active", "VTBR")];
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    Element.prototype.scrollIntoView = vi.fn();
    const Component = Route.options.component;
    if (!Component) throw new Error("Missing index component");
    try {
      render(<Component />);
      fireEvent.click(screen.getByTestId("news-ticker"));
      fireEvent.click(screen.getByRole("button", { name: "Другие идеи" }));
      expect(screen.getByRole("button", { name: "Самолёт 1" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Самолёт 2" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Самолёт 3" })).toBeNull();
    } finally {
      flight.ideas = previous;
    }
  });
  it("switches from active or closed to all statuses of the selected ticker", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    Element.prototype.scrollIntoView = vi.fn();
    const Component = Route.options.component;
    if (!Component) throw new Error("Missing index component");
    render(<Component />);

    fireEvent.click(screen.getByRole("button", { name: /^Активные / }));
    expect(screen.queryByRole("button", { name: "Самолёт 2" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Самолёт 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Другие идеи" }));
    expect(screen.getByRole("button", { name: "Самолёт 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Самолёт 2" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Самолёт 3" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Закрытые / }));
    fireEvent.click(screen.getByRole("button", { name: "Самолёт 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Другие идеи" }));
    expect(screen.getByRole("button", { name: "Самолёт 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Самолёт 2" })).toBeTruthy();
  });
});