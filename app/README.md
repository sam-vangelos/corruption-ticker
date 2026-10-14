# The Ethics Record app

A static site (Vite + React 18 + TypeScript) for The Ethics Record: a front
page with the headline count, counters and a seven-day cadence strip, then a
ticker, filters, charts, a month-grouped list and a detail drawer; a
permanent, prerendered page per record with a correct link preview; `/recent`,
`/method`, `/corrections`, `/subscribe`; and Atom feeds. There is no backend;
the build output in `dist/` can be served by any static host.

## Run it

```sh
cd app
npm install
npm run dev        # http://localhost:5173
```

## Build and check

```sh
SITE_URL=https://example.org npm run build   # tsc --noEmit, vite build, scripts/prerender.mjs
ALLOW_PLACEHOLDER_SITE_URL=1 npm run build   # same, with the placeholder origin
npm run smoke      # serves dist/ with `vite preview` and checks the pages and files below
```

`npm run smoke` needs a build first. It asserts HTTP 200 and content for `/`
(whose link preview must state the headline counts, recomputed in the smoke
script itself from the raw data), `/data/entries.json`, `/r/<first id>/`
(whose `og:title` must equal that record's title), `/feed.xml` and the first
record's category and office feeds, each route's own page, and the
corrections log.

### The prerender

`scripts/prerender.mjs` compiles `src/build/site.ts` with Vite's SSR build
(so it uses the app's own loader, counting rules and labels) and writes into
`dist/`:

- `r/<id>/index.html` for every record: a full `<title>`, `<meta
  name="description">`, Open Graph and Twitter card tags built from the
  record's current title, date, evidence grade, outlet and document kind,
  three statuses, any figures with their type, and a correction notice when
  the record appears in the corrections log. The body holds the same
  information as plain HTML, readable without JavaScript; the app script then
  mounts and opens that record's drawer. No `og:image` is generated; the card
  type is `summary`.
- the front page's preview tags, stating the headline sentence;
- a shell per route (`method.html` and `method/index.html`, and so on) with
  its own title, and `404.html`;
- Atom feeds, hand-written to RFC 4287 in `src/build/atom.ts` (no feed
  library): `feed.xml` with the 50 most recent records by
  `first_published_at`, and `feeds/office/<slug>.xml` and
  `feeds/category/<slug>.xml` for every office and category present. Each
  entry carries the record page URL, the evidence grade, the three statuses,
  any correction notice and the summary. Slugs come from `src/feeds.ts`,
  which `/subscribe` also uses.

Absolute URLs (canonical, `og:url`, feeds) use `SITE_URL`, which must be an
`https://` origin: `SITE_URL=https://example.org npm run build`. Without it the
build fails, unless `ALLOW_PLACEHOLDER_SITE_URL=1` asks for the reserved
placeholder origin `https://ethics-record.example` (no domain exists yet; the
smoke test sets it). A set but invalid `SITE_URL` always fails.

The build also fails, printing every problem, when the raw dataset holds:

- a record id that does not match `/^[a-z0-9][a-z0-9-]{2,120}$/` (ids become
  URL segments and directories: no `..`, no spaces, no capitals), or a
  duplicate id;
- a source `url` or `archive_url` that is not an absolute `http(s)` URL;
- a correction missing a required field, or whose `record_id` names no record
  in the public dataset (the offending correction is printed).

Drafts and rubric failures are not errors: they are left out of the public
files and listed in the build log. `DATASET_DIR=<dir>` builds from another
directory's `entries.json` and `corrections.json` (for testing fixtures).

## Data

The raw dataset lives in `dataset/entries.json` and `dataset/corrections.json`,
outside `public/`, so Vite never copies it into `dist/`. The build writes the
**public** dataset to `dist/data/entries.json`: only approved records that pass
the rubric. Leads (grade 5) and retracted records stay in it, labelled by their
own fields; drafts (`approved_by: null`) and rubric failures never reach
`dist/`, any record page, or any HTML. In development, Vite serves the raw files
at `/data/*.json` (an inline plugin in `vite.config.ts`) and the page lists
rejected records with their reasons; a production page says nothing about
them. The build log lists them.

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

The files in `dataset/` are a **placeholder fixture**: every title
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

- **Headline** (top of the page): "X qualifying records concerning Y distinct
  events since 20 January 2025", the average interval beneath it, and a "How
  we count" link to the methodology. Beside it, four counters: days since
  inauguration, records with a stated amount, records added in the last 30
  days, and records in investigation or litigation. Then the **cadence
  strip**: seven columns, one per calendar day in the viewer's time zone,
  with one mark per qualifying record added to the record that day (by
  `first_published_at`, never the event date). Each mark links to its record.
  The headline, counters and strip always describe the whole record; filters
  never change them, so a filtered view can never be passed off as the count.
- **Ticker** (very top): every record, newest first. Hover pauses it; the
  Pause control or keyboard focus freezes it into a scrollable strip. With
  reduced motion turned on in the OS it is always a static strip.
- **Filters**: search, category, actor, entity, evidence grade, evidentiary
  status, procedural status, date range, minimum dollars (compared with a
  record's largest stated figure). Every filter is written to the URL. Within
  one filter, values are alternatives (OR); across filters, all must hold
  (AND).
- **Charts and the list** follow the filters. Charts count qualifying records
  only; grade-5 leads and retracted records appear in the list, labelled,
  but are never charted. Each chart has a "Show table" view with the same
  numbers. There is no dollar chart and no dollar total anywhere.
- **Keyboard**: `/` search, `j`/`k` next and previous item, `Enter` open,
  `Esc` close, `t` light or dark theme, `+` large type (16px to 20px).

## Pages

- `/` the record: headline block, filters, charts, the list, the drawer.
- `/method` how we count: the evidence grades table, the counting rules, the
  inclusion rubric and the recommended citation with the dataset version
  string. All of it renders from `src/method.ts`, the same constants the
  counting code (`src/data/metrics.ts`) and the loader read, so the published
  rules cannot drift from the arithmetic.
- `/r/<id>/` a record's permanent page. In the app, opening a card moves the
  address bar to that record's URL, so copying it gives the shareable link;
  closing the drawer returns to `/`. Old `?item=<id>` links redirect there.
- `/recent` records added or changed in the last 24 hours, then the rest of
  the last 7 days, by `first_published_at` and `last_modified_at`, each
  linking to its record page. An empty window says "Nothing added in the
  last 24 hours."
- `/subscribe` the Atom feeds, listed with their addresses.
- `/corrections` every post-publication change from
  `public/data/corrections.json` (date, record id, field, old value, new
  value, reason), newest first.

Links between pages navigate in place with the History API (`src/router.ts`).

## Design notes

Color means exactly two things here: **category** and **status**. Chrome,
text, the aggregate chart marks and the evidence-grade marks are neutral ink,
so a colored mark is never mistaken for a category. Neither meaning relies on
color alone: categories always carry a text label and a distinct glyph shape,
and statuses always carry a field name, a text label and an icon shape.

**Evidence grades** are shown as a four-bar strength meter drawn in ink
(`src/grades.tsx`): grade 1 fills four bars, grade 2 three, grade 3 two,
grade 4 one, and grade 5 (a lead) none, with a dashed outline. Five distinct
shapes and no new hue: eleven category hues already span the wheel, so any
grade hue would sit beside a same-colored category glyph on the same card. The
mark always travels with its text (the grade's verb on cards, "Grade N: name"
elsewhere), and leads and retracted records carry a visible "Lead, not
counted" or "Retracted, not counted" tag and a dashed card outline.

**Language follows the grade** (docs/schema.md editorial rules): cards and the
drawer show the grade's verb (found, documented, reported, alleged
(corroborated), alleged), from `GRADES` in `src/method.ts`.

**Status** is three labelled chips (`src/status.tsx`): Evidence, Procedure,
Response, each with an icon whose shape is unique within its field. Icons are
ink; three reserved status hues remain, for the states a reader most needs to
spot (under investigation `#fab219`, in litigation `#ec835a`, retracted
`#6b6a65`), always inside an ink-outlined icon beside the label. Retracted
values are also struck through. v1's single status badge and its other three
hues are gone.

Dark is the default theme, on a graphite page with off-white text to reduce
halation. Every text token clears WCAG AA (4.5:1) on every surface in both
themes, and control borders clear 3:1. The headline sentence is the only
display type; counter values were reduced to 1.625rem to keep it so.

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
