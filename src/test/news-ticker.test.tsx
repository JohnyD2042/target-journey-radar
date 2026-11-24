import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewsTicker } from "@/components/NewsTicker";
import type { Idea } from "@/lib/ideas";
import type { FeedEvent } from "@/lib/feed";

const idea: Idea = {
  id: 42, ticker: "T", name: "Т-Технологии", analyst: "Автор", strategy: "лонг",
  status: "active", openedLabel: "", start: 100, current: 110, target: 120,
  yieldPct: 10, toTargetPct: 9, noTarget: false, capturedX: 0.5, stage: "cruise",
};
const events: FeedEvent[] = [
  { id: "idea", kind: "open", idea, name: idea.name, text: "новая идея" },
  { id: "ticker", kind: "stat", ticker: "T", text: "Самая популярная акция недели" },
  { id: "analyst", kind: "stat", analyst: "Автор", text: "Самый активный аналитик недели" },
];

describe("manual news capsules", () => {
  it("selects the specific idea from its capsule", () => {
    const onIdea = vi.fn();
    render(<NewsTicker events={events} onIdea={onIdea} onTicker={vi.fn()} onAnalyst={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Т-Технологии/ }));
    expect(onIdea).toHaveBeenCalledExactlyOnceWith(idea);
  });

  it("selects the weekly stock from its own capsule", () => {
    const onTicker = vi.fn();
    render(<NewsTicker events={events} onIdea={vi.fn()} onTicker={onTicker} onAnalyst={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Самая популярная акция недели" }));
    expect(onTicker).toHaveBeenCalledExactlyOnceWith("T");
  });

  it("selects the weekly analyst from its own capsule", () => {
    const onAnalyst = vi.fn();
    render(<NewsTicker events={events} onIdea={vi.fn()} onTicker={vi.fn()} onAnalyst={onAnalyst} />);
    fireEvent.click(screen.getByRole("button", { name: "Самый активный аналитик недели" }));
    expect(onAnalyst).toHaveBeenCalledExactlyOnceWith("Автор");
  });
});