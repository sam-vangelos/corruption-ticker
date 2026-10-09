# App v1 build brief: Corruption Ticker

## Goal

A static single-page web app that makes the scale of the dataset graspable at a glance and lets Sam interact with every item: scroll it as a ticker, filter it, chart it, and follow each item back to its sources. Linear: CLO-433.

## Constraints (ruled out)

- No backend, no auth, no analytics, no third-party UI kit. Vite + React 18 + TypeScript. Charts hand-rolled in SVG (no chart library) following the dataviz rules below. Minimal dependencies: `react`, `react-dom`, `vite`, `typescript`, and nothing else unless justified in the report.
- No real-looking placeholder data. Until the real dataset lands, the app runs on `public/data/entries.json` containing ~15 entries that are obviously placeholders: titles prefixed `[PLACEHOLDER]`, sources at `https://example.com/...`, `"placeholder": true`. Never write entries that could be mistaken for real reporting.
- Do not touch `data/`, `docs/`, `README.md`, or `plans/`. The dataset research workflow writes into `data/raw/` concurrently.
- Theme: low saturation, high contrast. Sam has keratoconus. Dark theme by default, light theme available, both with WCAG AA contrast or better on all text. A large-type toggle (base 16px → 20px). Never rely on color alone for meaning.

## Data contract

Read `docs/schema.md` in full before writing types. `src/types.ts` mirrors it exactly. Load `/data/entries.json` at startup with `fetch`; the app must render an honest empty state if the file is missing or empty. Derived indexes (by month, by category, by actor, by entity) are computed once with `useMemo`.

## Features

1. **Ticker.** A full-width strip at the top that scrolls item titles continuously right to left (CSS animation, duplicated track for a seamless loop). Each title is prefixed with its date and category glyph. Pauses on hover and on focus; `prefers-reduced-motion` turns it into a static horizontally scrollable strip. Clicking a title opens the detail drawer.
2. **Counters row.** Five stat tiles: days since 2025-01-20; total items; items per week (total / weeks elapsed); total reported dollars (sum of `dollar_amount_usd`, with a hover tooltip stating the number of entries that carry a figure and that figures are as reported, not adjudicated); items in the last 30 days. Numbers in tabular figures.
3. **Filter bar.** One row above the stream: category (multi-select chips), actor (searchable multi-select), entity (searchable multi-select), status (multi-select), date range (from/to), minimum dollar amount, free-text search over title + summary + actors + entities. Every filter is reflected in the URL query string and restored on load. A "clear all" control. The counters and charts respond to the active filters; the ticker always shows the full set.
4. **Stream.** Reverse-chronological feed grouped under month headers (`October 2026`, with the month's count). Each card: date, category label, title, actors as chips, dollar figure if any, status badge with an icon, outlet names as links. Click or Enter opens the drawer. Virtualize only if needed; 1,000 cards must scroll smoothly.
5. **Charts panel** (collapsible, above the stream): items per month (bar), cumulative items over time (line), items by category (horizontal bar, sorted), cumulative reported dollars over time (line). Each chart has a hover tooltip and a toggle to a plain table view.
6. **Detail drawer.** Slides in from the right: title, date, category, status + status note, full summary, actors, entities, dollar figure with its basis, every source as outlet + headline + link, related entries as links that swap the drawer content. Escape closes; focus is trapped while open and returned on close.
7. **Keyboard.** `/` focuses search, `j`/`k` move through cards, Enter opens, Escape closes, `t` toggles theme, `+` toggles large type.

## Design rules (from the dataviz skill; apply as written)

- Read `/private/tmp/claude-502/bundled-skills/2.1.293/3bfbebdafb6d6143de06385fe66213c6/dataviz/references/palette.md`, `color-formula.md`, `marks-and-anatomy.md`, `interaction.md`, and `anti-patterns.md` before writing any chart or picking any color.
- Categories get a fixed-order categorical palette of 11 hues; run `node scripts/validate_palette.js "<hex,...>" --mode dark` and `--mode light` from the dataviz base directory and paste both reports into your final report. Fix any FAIL. Each category also gets a text label and a small glyph so identity is never color-alone.
- Sequential = one hue. No dual axes. Thin marks, recessive grid, legend present for ≥ 2 series. Text uses text tokens, never series color.
- Status colors (reported / under-investigation / litigation / confirmed / disputed / retracted) are a reserved palette with icons and are not reused for categories.
- Read the frontend-design skill at `/Users/sam.vangelos/.claude/plugins/cache/claude-plugins-official/frontend-design/315c4e48967d/skills/frontend-design/SKILL.md` for typography and layout direction. One serious typeface pairing (a system stack is fine), generous spacing, no decoration that does not carry information.

## Files you own

Everything under `app/` (create it): `app/package.json`, `app/vite.config.ts`, `app/tsconfig.json`, `app/index.html`, `app/public/data/entries.json` (placeholder), `app/src/**`. Also `app/README.md` with run instructions. Nothing outside `app/`.

## Gate

From `app/`: `npm install`, `npm run build` (must succeed with zero TypeScript errors), `npm run lint` if you add eslint (optional), and a smoke script `npm run smoke` that starts `vite preview`, fetches `/` and `/data/entries.json`, and asserts both return 200. Capture exit codes to `app/.gate/exit-codes.txt` and read the file back. Then run the dev server, open the app with a headless check (`curl` the HTML is enough if no browser is available) and describe what renders.

## Commit shape

Branch `app-v1` in the worktree. Commits in this order, each buildable: (1) scaffold + types + data loading + empty state; (2) ticker + counters; (3) filters + URL state + stream; (4) charts; (5) drawer + keyboard; (6) theme + large type + accessibility pass. No merge, no push, no stash.

## Report

Plain prose: what was built (file:line for the key pieces), the two palette validator reports, gate results with exit codes, commit SHAs, anything seen outside scope, every deviation from this brief with the reason.
