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
- Render zone labels and counts inside the map, outside its pan/zoom transform; navigation and reset must not remove the overview.
- Board selections scroll to the map wrapper and reset its viewport; include a selected board idea in the rendered set even when header filters exclude it, so its plane and details remain visible.
- Analyst board selections use the header analyst filter and clear other filters and pinned ideas, so the map shows the author's entire history without unrelated planes.
- Flight data is fetched once in full from the external /flight API (src/lib/ideas.ts, refresh ≤ every 15 min); filters and counters are applied locally via applyFilters, but yield, zones (stage) and the full Y range come from the API — never compute them locally; the chart only narrows its Y axis to the shown ideas via fitYRange.
