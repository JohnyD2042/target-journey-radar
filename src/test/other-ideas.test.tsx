import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Idea } from "@/lib/ideas";
import { Route } from "@/routes/index";

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: (data: unknown) => data,
  useQuery: () => ({ data: flight, isError: false, isFetching: false, dataUpdatedAt: 1 }),
}));
vi.mock("@/components/FlightChart", () => ({
  FlightChart: ({ ideas, onSelect, selectedId }: { ideas: Idea[]; onSelect: (idea: Idea) => void; selectedId?: string }) => (
    <div data-testid="map-ideas" data-selected-id={selectedId}>
      {ideas.map((idea) => <button key={idea.id} onClick={() => onSelect(idea)}>Самолёт {idea.id}</button>)}
    </div>
  ),
  ZoneGlyph: () => null,
  ZONE_ICON: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
  ZONE_TEXT: {},
}));
vi.mock("@/components/Boards", () => ({
  Boards: ({ ideas, onPick, onAnalystPick, onTickerPick }: {
    ideas: Idea[]; onPick: (idea: Idea) => void; onAnalystPick: (name: string) => void;
    onTickerPick: (ticker: string, status: "all") => void;
  }) => (
    <div>
      {ideas.map((i) => <button key={i.id} onClick={() => onPick(i)}>Табло идея {i.id}</button>)}
      <button onClick={() => onTickerPick("CHMF", "all")}>Табло CHMF</button>
      <button onClick={() => onAnalystPick("A")}>Табло аналитик A</button>
    </div>
  ),
}));
vi.mock("@/components/IdeaPath", () => ({ IdeaPath: () => null, BasketTag: () => null, SideTag: () => null }));

const idea = (id: number, status: Idea["status"], ticker = "CHMF"): Idea => ({
  id, ticker, status, name: ticker, analyst: "A", strategy: "лонг", openedLabel: "",
  start: 100, current: 110, target: 120, yieldPct: 35, toTargetPct: 9,
  assetType: "stock", analystType: "institutional",
  noTarget: false, capturedX: 0.5, stage: "cruise",
});
const flight = {
  asOf: "2026-11-17", yieldMin: -50, yieldMax: 100,
  ideas: [idea(1, "active"), idea(2, "closed"), idea(3, "active", "SBER")],
};

function failMissingNews(): never { throw new Error("Missing news event"); }

describe("Другие идеи", () => {
  it("board idea selection clears the old ticker and restores every idea on each selection", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    Element.prototype.scrollIntoView = vi.fn();
    const Component = Route.options.component;
    if (!Component) throw new Error("Missing index component");
    render(<Component />);
    fireEvent.click(screen.getByRole("button", { name: "Табло CHMF" }));
    expect(screen.queryByRole("button", { name: "Самолёт 3" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Активные / }));
    fireEvent.click(screen.getByRole("button", { name: "Табло идея 3" }));
    expect(screen.getByPlaceholderText("Тикер или название…")).toHaveValue("");
    for (const id of [1, 2, 3]) expect(screen.getByRole("button", { name: `Самолёт ${id}` })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Другие идеи" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Другие идеи" }));
    expect(screen.queryByRole("button", { name: "Самолёт 1" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Табло идея 2" }));
    for (const id of [1, 2, 3]) expect(screen.getByRole("button", { name: `Самолёт ${id}` })).toBeTruthy();
    expect(screen.getByTestId("map-ideas")).toHaveAttribute("data-selected-id", "2");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("news idea selection clears analyst, period and type filters", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    Element.prototype.scrollIntoView = vi.fn();
    const Component = Route.options.component;
    if (!Component) throw new Error("Missing index component");
    render(<Component />);
    fireEvent.click(screen.getByRole("button", { name: "Табло аналитик A" }));
    fireEvent.click(screen.getByRole("button", { name: /^Акции / }));
    fireEvent.click(screen.getByRole("button", { name: /^Профучастники / }));
    fireEvent.click(screen.getByRole("button", { name: /^Неделя / }));
    fireEvent.click(screen.getByRole("button", { name: /^Закрытые / }));
    expect(screen.queryByRole("button", { name: "Самолёт 1" })).toBeNull();
    fireEvent.click(screen.getAllByTestId("news-ticker")[0] ?? failMissingNews());
    expect(screen.getByPlaceholderText("Все аналитики — поиск…")).toHaveValue("");
    expect(screen.getByRole("button", { name: /^Акции / })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^Профучастники / })).toHaveAttribute("aria-pressed", "false");
    for (const id of [1, 2, 3]) expect(screen.getByRole("button", { name: `Самолёт ${id}` })).toBeTruthy();
  });

  it("shows all and only T ideas after opening its news event", () => {
    const previous = flight.ideas;
    flight.ideas = [{ ...idea(1, "active", "T"), yieldPct: 35 }, idea(2, "closed", "T"), { ...idea(3, "active", "VTBR"), yieldPct: 10 }];
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    Element.prototype.scrollIntoView = vi.fn();
    const Component = Route.options.component;
    if (!Component) throw new Error("Missing index component");
    try {
      render(<Component />);
      fireEvent.click(screen.getByRole("button", { name: /^лонг T A / }));
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