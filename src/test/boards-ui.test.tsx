import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Boards } from "@/components/Boards";
import type { Idea } from "@/lib/ideas";

const AS_OF = "2026-11-14";

const idea = (o: Partial<Idea> & { opened?: string }): Idea => ({
  id: Math.random(), ticker: "X", name: "X", analyst: "A", strategy: "лонг", status: "active", opened: "2026-11-04",
  openedLabel: "", start: 1, current: 1, target: 2, yieldPct: 1, toTargetPct: 0, noTarget: false, capturedX: 0, stage: "liftoff", ...o,
} as Idea);

const header = (title: string) => screen.queryByRole("button", { name: new RegExp(title) });
const rows = (title: string) => header(title)!.closest("section")!.querySelectorAll("ol > li").length;

function renderBoards(ideas: Idea[]) {
  render(<Boards ideas={ideas} asOf={AS_OF} onPick={() => {}} onAnalystPick={() => {}} onTickerPick={() => {}} />);
}

describe("Раскрытие таблицы по заголовку", () => {
  const eight = Array.from({ length: 8 }, (_, k) => idea({ id: k, ticker: `T${k}`, yieldPct: 10 - k }));

  it("the header expands the board to every row and collapses it back", () => {
    renderBoards(eight);
    const h = header("Бодрый старт")!;
    expect(h.getAttribute("aria-expanded")).toBe("false");
    expect(rows("Бодрый старт")).toBe(5);

    fireEvent.click(h);
    expect(h.getAttribute("aria-expanded")).toBe("true");
    expect(rows("Бодрый старт")).toBe(8);

    fireEvent.click(h);
    expect(h.getAttribute("aria-expanded")).toBe("false");
    expect(rows("Бодрый старт")).toBe(5);
  });

  it("keeps the footer button working next to the header", () => {
    renderBoards(eight);
    const board = header("Бодрый старт")!.closest("section")!;
    fireEvent.click(within(board).getByRole("button", { name: /Показать топ-/ }));
    expect(rows("Бодрый старт")).toBe(8);
    expect(within(board).getByRole("button", { name: /Свернуть до 5 строк/ })).toBeTruthy();
    fireEvent.click(within(board).getByRole("button", { name: /Свернуть до 5 строк/ }));
    expect(rows("Бодрый старт")).toBe(5);
  });

  it("does not offer a header toggle when there are five rows or fewer", () => {
    renderBoards(Array.from({ length: 3 }, (_, k) => idea({ id: k, ticker: `T${k}` })));
    expect(header("Бодрый старт")).toBeNull();
    expect(screen.queryByRole("button", { name: /Показать топ-/ })).toBeNull();
  });

  it("leaves the punctuation board without any toggle", () => {
    renderBoards(eight);
    expect(header("Пунктуальность")).toBeNull();
  });
});

describe("Статус идей при переходе из таблицы", () => {
  it("КПД selects all statuses for the asset, including closed ideas", () => {
    const onTickerPick = vi.fn();
    render(<Boards ideas={[
      idea({ id: 1, ticker: "SPBE", status: "active" }),
      idea({ id: 2, ticker: "SPBE", status: "closed" }),
      idea({ id: 3, ticker: "SPBE", status: "closed" }),
    ]} asOf={AS_OF} onPick={() => {}} onAnalystPick={() => {}} onTickerPick={onTickerPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Показать идеи SPBE" }));
    expect(onTickerPick).toHaveBeenCalledExactlyOnceWith("SPBE", "all");
  });

  it("Новые герои still selects only active ideas", () => {
    const onTickerPick = vi.fn();
    render(<Boards ideas={[idea({ ticker: "SPBE" })]} asOf={AS_OF} onPick={() => {}} onAnalystPick={() => {}} onTickerPick={onTickerPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Показать активные идеи SPBE" }));
    expect(onTickerPick).toHaveBeenCalledExactlyOnceWith("SPBE", "active");
  });
});
