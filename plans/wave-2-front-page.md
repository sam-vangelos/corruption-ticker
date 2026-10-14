# Wave 2 build brief: the front page

Linear: CLO-461. Builds on app v1 (`app/`). Read `plans/concept.md` (v2) and `docs/schema.md` (v2) in full first; they are the spec. This brief says what to build in this wave and what to leave.

## Goal

Turn the app from a reader into a record: the honest headline, the cadence strip, a permanent page per record with a correct link preview, a `/recent` page, an RSS/Atom feed, and the methodology pages the headline links to. All on a static host, no server.

## Ruled out

- No backend, no email service, no purchases, no new UI kit or chart library. Keep the dependency set from v1 plus at most one small library for feed generation if hand-rolling Atom is unreasonable (justify in the report).
- No grand dollar total anywhere. Remove it from the counters. The financial-stakes rows are wave 3; for now the dollar counter is replaced by "records with a stated amount: N".
- No "acts of corruption," no "K a week," no "since you opened this page," no bare-number embed. The headline wording is fixed by `plans/concept.md` § The headline.
- Placeholder data stays unmistakably fake (`[PLACEHOLDER]` titles, example.com URLs, `placeholder: true`). Migrate the fixture to schema v2 and keep it to about 20 records including at least three parent/child trees, two grade-5 leads, one retracted record, and records with each `amount_type`.
- Do not touch `data/`, `docs/`, `plans/`, root `README.md`.

## What to build

1. **Schema v2 types and loader.** `src/types.ts` mirrors `docs/schema.md` v2 exactly. The loader validates v2, rejects v1 records with a clear message, and computes the metric set per the counting rules: grade 1 to 4, `evidentiary_status` not `retracted`; root records are those with `root_id: null`.
2. **Headline block** replaces the v1 counters row: "X qualifying records concerning Y distinct events since 20 January 2025" in large type, the average interval beneath ("one new qualifying record every N hours on average, counted over distinct events"), and a "how we count" link to the methodology page. Counters that remain: days since inauguration, records with a stated amount, records added in the last 30 days (by `first_published_at`), records in investigation or litigation.
3. **Cadence strip**: seven columns, one per day for the last seven days, marks per record added that day by `first_published_at`, labelled "records added to the record" so it is visibly distinct from event dates. Reduced-motion and keyboard rules from v1 apply.
4. **Methodology pages** (static routes in the SPA): `/method` renders the evidence grades table, the counting rules, and the inclusion rubric from a single source of truth in `src/method.ts` (not duplicated prose), plus the "recommended citation" block with the dataset version string. `/corrections` renders `public/data/corrections.json` (array per schema v2 editorial rules; fixture has two placeholder corrections).
5. **Record pages with correct link previews.** A build step (`app/scripts/prerender.mjs`, run by `npm run build` after Vite) writes `dist/r/<id>/index.html` for every record: full `<title>`, `<meta name="description">`, Open Graph and Twitter card tags built from the record's current title, date, evidence grade label, outlet or document kind, current statuses, the amount and type if any, and a correction notice if the id appears in corrections. The page body contains the same information as plain HTML (so it is readable without JS) and a script that loads the SPA with that record's drawer open. No image generation; an `og:image` is omitted in this wave rather than faked.
6. **`/recent`**: records added or modified in the last 24 hours and the last 7 days by `first_published_at` / `last_modified_at`, each linking to its record page. Empty state says "Nothing added in the last 24 hours" without apology.
7. **Feeds.** The build step also writes `dist/feed.xml` (Atom) of the 50 most recent records by `first_published_at`, and `dist/feeds/office/<slug>.xml`, `dist/feeds/category/<slug>.xml` for every office and category present. Each entry carries the record page URL, grade, statuses. A `/subscribe` route lists the feeds.
8. **Grade-matched language.** Card and drawer verbs follow the schema's editorial rule (found / documented / reported / alleged (corroborated) / alleged), driven from `evidence_grade`, and grade-5 records show a visible "lead, not counted" label and are excluded from the headline and charts.
9. **Status display.** Three status fields rendered as three labelled chips with icons; the single v1 status badge goes away.

## Design

Same theme and accessibility rules as v1 (low saturation, high contrast, dark default, large-type toggle, keyboard everything). The headline block is the only element allowed large display type. Evidence grades get five distinct marks that are not the category palette and not the status palette; validate any new colors with the dataviz validator in both modes and include the reports.

## Files you own

Everything under `app/`. Nothing else.

## Gate

From `app/`: `npm run build` (Vite then prerender, exit 0, zero TS errors), `npm run smoke` extended to assert 200 on `/`, `/data/entries.json`, `/r/<first-fixture-id>/`, `/feed.xml`, and that `/r/<id>/index.html` contains an `og:title` meta tag whose content matches the record title. Capture exit codes to `app/.gate/exit-codes.txt` and read the file back. Report what `/method`, `/recent`, and one record page render.

## Commit shape

Branch `wave-2` in the worktree. Commits in order, each buildable: (1) schema v2 types, loader, migrated fixture, corrections fixture; (2) headline block and cadence strip; (3) methodology and corrections pages; (4) prerendered record pages; (5) `/recent` and feeds; (6) grade-matched language, three-field status, accessibility pass. No merge, no push, no stash.

## Report

Plain prose: what was built with file:line for key pieces, validator reports, gate results with exit codes, commit SHAs, what you saw outside scope, every deviation with the reason, and the serving model named from your own transcript.
