<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep flight-map viewport math in the browser-safe map-view module with unit tests; this separates navigation from animated rendering.
- Keep board heading symbols in the shared browser-safe board-icons module and reuse them for matching aggregate news stories so sections cannot drift apart.
- Reuse IDEA_ICON and SideTag for idea direction in news, board rows, cards, tooltips and the direction key; retain the map's top-down animated markers and zone glyphs as distinct cartographic symbols.
- Render zone labels and counts inside the map, outside its pan/zoom transform; navigation and reset must not remove the overview.
- Individual idea selections from boards or news clear all header filters, show the full dataset, replace the pinned idea, scroll to the map wrapper and reset its viewport; this prevents stale instrument or analyst selections from mixing unrelated planes.
- Analyst board selections use the header analyst filter and clear other filters and pinned ideas, so the map shows the author's entire history without unrelated planes.
- Compute ticker boards in the browser-safe boards module from the full API dataset; ticker selections explicitly pass their status scope and clear other filters and pins, so historical boards show all ideas while dormant-asset navigation shows active ideas.
- Flight data is fetched once in full from the external /flight API (src/lib/ideas.ts, refresh ≤ every 15 min); filters and counters are applied locally via applyFilters, but yield, zones (stage) and the full Y range come from the API — never compute them locally; the chart only narrows its Y axis to the shown ideas via fitYRange.
- Resolve known ticker codes against the full dataset and match complete codes (including basket members) in applyFilters; reserve substring matching for name/free-text search so short codes cannot select unrelated instruments.
- Build the event feed in the browser-safe feed module from the full dataset and freeze its snapshot for 12 hours; round-robin real scenario queues before deterministic shuffling to reserve diverse stories and deduplicate idea IDs. Reuse board selectors for upside, pace, arrivals and rankings; never fabricate missing events or metrics. Show scenario and labelled value without truncation in the manual horizontal capsule strip; native touch scrolling and mouse dragging suppress accidental selection. Idea events reuse board selection; aggregate events pass their explicit period scope through the shared ticker/analyst navigation handlers with status "all", so weekly stories do not open all-time history. The unqualified weekly summary clears all narrow filters. Weekly summaries use the header's inPeriod predicate and count basket members toward known stocks.
