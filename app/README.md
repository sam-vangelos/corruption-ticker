# Corruption Ticker app

A static single-page app (Vite + React 18 + TypeScript) that reads
`public/data/entries.json` at startup and shows it as a ticker, counters,
filters, charts, a month-grouped stream, and a detail drawer. There is no
backend; the build output in `dist/` can be served by any static host.

## Run it

```sh
cd app
npm install
npm run dev        # http://localhost:5173
```

## Build and check

```sh
npm run build      # type-checks (tsc --noEmit) then bundles to dist/
npm run smoke      # serves dist/ with `vite preview`, asserts / and /data/entries.json return 200
```

`npm run smoke` needs a build first.

## Data

The app loads `/data/entries.json`, a JSON array of records following dataset
schema v2 (`docs/schema.md`, mirrored field for field in `src/types.ts`), and
`/data/corrections.json`, the corrections log. The loader
(`src/data/load.ts`) validates every record and skips, with a stated reason,
any record that fails: unknown enum values, an evidence grade outside 1 to 5,
a figure without `amount_type`, `actual_or_estimated` or `basis`, a source
without `archive_url`, `approved_by: null` (not in the public dataset), a
missing `first_published_at`, a record naming only private actors below grade
3 or without a recorded response, or a child whose `root_id` does not name a
root in the file. Schema v1 records (a single `status`, a `dollar_amount_usd`)
are rejected with a message saying to migrate them; a file that is entirely
v1 shows only that message.

The metric set follows the schema's counting rules: a record counts when its
`evidence_grade` is 1 to 4 and its `evidentiary_status` is not `retracted`;
events are the counted records with `root_id: null`. The constants live in
`src/method.ts` and the arithmetic in `src/data/metrics.ts`.

The files shipped in `public/data/` are a **placeholder fixture**: every title
starts with `[PLACEHOLDER]`, every source and archive URL points at
`https://example.com/`, every record has `"placeholder": true`, and every name
is invented. The fixture holds 20 records: three parent/child trees, two
grade-5 leads, one retracted record, one record naming only private actors,
and figures of each `amount_type`. It counts 17 qualifying records concerning
13 distinct events. Its `first_published_at` times cluster in the week to 13
October 2026 so the cadence strip and `/recent` have something to show; as
the calendar moves on they empty out, which is the behaviour real data would
have on a quiet week. The app shows a notice whenever any loaded record
carries the placeholder flag.

## Using it

- **Ticker** (top): every item, newest first. Hover pauses it; the Pause
  control or keyboard focus freezes it into a scrollable strip. With
  reduced motion turned on in the OS it is always a static strip.
- **Filters**: search, category, actor, entity, status, date range, minimum
  dollars. Every filter is written to the URL, so a filtered view can be
  bookmarked or shared; `?item=<id>` opens one item's details. Within one
  filter, values are alternatives (OR); across filters, all must hold (AND).
- **Counters and charts** follow the filters. The ticker always shows
  everything. Each chart has a "Show table" view with the same numbers.
- **Keyboard**: `/` search, `j`/`k` next and previous item, `Enter` open,
  `Esc` close, `t` light or dark theme, `+` large type (16px to 20px).

## Design notes

Color means exactly two things here: **category** and **status**. Chrome,
text, and the aggregate chart marks are neutral ink, so a colored mark is
never mistaken for a category. Neither meaning relies on color alone:
categories always carry a text label and a distinct glyph shape, and statuses
always carry an icon shape and a text label.

Dark is the default theme, on a graphite page with off-white text to reduce
halation. Every text token clears WCAG AA (4.5:1) on every surface in both
themes, and control borders clear 3:1.

Category palette, fixed order (schema order), validated with the dataviz
skill's `scripts/validate_palette.js` on adjacent pairs:

| Slot | Category | Dark | Light |
|---|---|---|---|
| 1 | Self-enrichment | `#3987e5` | `#2a78d6` |
| 2 | Foreign emoluments | `#c98500` | `#eda100` |
| 3 | Crypto | `#9085e9` | `#4a3aa7` |
| 4 | Pardons and clemency | `#008300` | `#008300` |
| 5 | Pay to play | `#d55181` | `#e87ba4` |
| 6 | Nepotism and cronyism | `#ad6c24` | `#93591a` |
| 7 | Contracts and procurement | `#0e9cb0` | `#00899b` |
| 8 | Oversight retaliation | `#d95926` | `#eb6834` |
| 9 | Abuse of office | `#199e70` | `#1baf7a` |
| 10 | Conflicts of interest | `#b46ac2` | `#a24fb0` |
| 11 | Misuse of funds | `#e66767` | `#e34948` |

The dataviz reference palette's eight hues keep their documented steps
(slots 1, 2, 3, 4, 5, 8, 9, 11); umber (6), teal (7), and plum (10) were
added to reach eleven, and the order was chosen by search to maximize the
worst adjacent CVD separation in both modes. Re-run from the dataviz skill directory:

```sh
node scripts/validate_palette.js "#3987e5,#c98500,#9085e9,#008300,#d55181,#ad6c24,#0e9cb0,#d95926,#199e70,#b46ac2,#e66767" --mode dark
node scripts/validate_palette.js "#2a78d6,#eda100,#4a3aa7,#008300,#e87ba4,#93591a,#00899b,#eb6834,#1baf7a,#a24fb0,#e34948" --mode light
```

Both pass. Light mode reports a contrast WARN for three hues (yellow,
magenta, aqua under 3:1 on the light surface); the relief is that every
category mark sits beside its text label, and glyphs carry an ink outline in
the light theme. Eleven hues cannot be pairwise-distinct under the
all-pairs check, which is why the label and glyph shape travel with every
use of category color.
