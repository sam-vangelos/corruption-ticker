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
SITE_URL=https://example.org npm run build   # tsc --noEmit, vite build, prerender, then npm run verify
ALLOW_PLACEHOLDER_SITE_URL=1 npm run build   # same, with the placeholder origin
npm run verify                               # the adversarial suite on its own (needs a built dist/index.html)
npm run smoke                                # checks the served output of the build in dist/
```

**`npm run verify`** (`scripts/verify.mjs`) is the adversarial fixture suite,
and `npm run build` runs it after the prerender, so a build in which any gate
has slipped fails. Every case is a variant of the dataset in use (resolved by
the shared resolver), prerendered into a throwaway copy of `dist/`, never the
real one. It requires a failed build, with the right record and reason
printed, for each admission gate:

- a duplicate id (a draft followed by its approved twin);
- an approval digest tampered by an edit after approval, an approver other
  than the editor, and a draft given the editor's name without a digest;
- an approved record with an invalid value, a root that is not public, or a
  rubric failure;
- each actor-coercion case (a number, a blank, a duplicate, a missing role,
  an empty list) and a non-string entity;
- no sources, each grade's missing source kind, a single-outlet grade 4, and
  a non-http(s) URL;
- a pre-2025 date, a wrong opening verb, and an unattributed guilt phrase;
- an id of `..`;
- a correction edited after approval, approved by someone else, with a field
  that is not a schema path, naming a non-public record (approved or draft),
  or naming no public record;
- a loopback `SITE_URL`, and a `DATASET_DIR` without `ALLOW_DATASET_DIR`.

Verify also requires two builds to succeed (an attributed guilt phrase; a
grade-1 finding saying "committed"). It searches every file of a build with
planted secrets for them, checks that the prerender removes a stale page and
feed, and checks the pure-TypeScript SHA-256 against `node:crypto`.

**`npm run smoke`** (`scripts/smoke.mjs`) checks the served output: it serves
`dist/` with `vite preview` on a free port (it listens on port 0 and uses the
port it gets) and requires every page to carry this build's id from
`dist/build.json`, so a stale server can never answer for it. Against counts
recomputed in the script, independently of the app's code, it checks:

- no unapproved, unpublished or rubric-failing record from the dataset appears
  in `/data/entries.json`, in the front-page HTML, or as a page under
  `dist/r/`, and every approved, rubric-passing, published record does;
- public records carry schema keys only, and their `related_ids` resolve;
- every id is URL-safe;
- the visible front-page headline and interval sentence (the SPA's own
  `Headline` component, rendered into the HTML at build time) and the front
  page's `og:description` equal the recount, and the fixture still contains a
  qualifying child under a non-qualifying root, so a roots-only event rule
  would fail;
- every record page answers 200 with an `og:title` and `<h1>` that, entities
  decoded, equal the record's title;
- `/feed.xml` and every office and category feed hold exactly the newest
  qualifying records they should, each with the right `<updated>`, and feeds
  exist exactly for the offices and categories with a qualifying record;
- `/feeds/index.json` lists exactly the feed files the build wrote, with the
  right counts;
- corrections name only public records, and each route is its own page.

**Continuous integration.** `ci/ci.yml` is a GitHub Actions workflow that runs
`npm ci`, `npm run build` (with verify) and `npm run smoke` on every push and
pull request. GitHub reads workflows only from `.github/workflows/` at the
repository root, which is outside `app/`; move the file there.

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
  library), of qualifying records only: `feed.xml` with the 50 most recent by
  `first_published_at`, and `feeds/office/<slug>.xml` and
  `feeds/category/<slug>.xml` for every office and category with at least one
  qualifying record. Each entry carries the record page URL, the evidence
  grade, the three statuses, any correction notice and the summary; its
  `<updated>` is the latest of `first_published_at`, `last_modified_at` and
  the date of any correction to the record. Slugs come from `src/feeds.ts`
  (lowercase, NFKD with diacritics stripped, each run of other characters to
  one hyphen, ends trimmed), which `/subscribe` also uses; two office names
  that share a slug fail the build rather than being suffixed.

Absolute URLs (canonical, `og:url`, feeds) use `SITE_URL`, which must be an
`https://` origin: `SITE_URL=https://example.org npm run build`. Without it the
build fails, unless `ALLOW_PLACEHOLDER_SITE_URL=1` asks for the reserved
placeholder origin `https://ethics-record.example` (no domain exists yet; the
smoke test sets it). A set but malformed `SITE_URL` always fails. A
well-formed one that is not a public origin (the placeholder origin or any
`.example` host, `localhost`, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12,
192.168.0.0/16, `.local` or `.test`) fails unless
`ALLOW_PLACEHOLDER_SITE_URL=1`.

The build also fails, printing every problem, when the raw dataset holds:

- a record id that does not match `/^[a-z0-9][a-z0-9-]{2,120}$/` (ids become
  URL segments and directories: no `..`, no spaces, no capitals), or a
  duplicate id;
- a source `url` or `archive_url` that is not an absolute `http(s)` URL;
- a correction missing a required field, or whose `record_id` names no record
  in the public dataset (the offending correction is printed).

Drafts are not errors: they are left out of the public files and listed in
the build log, as are approved records not yet published.

The raw dataset directory is resolved in one place, `scripts/dataset-dir.mjs`,
used by the prerender, the smoke test and the dev server alike. It is
`app/dataset/` unless `DATASET_DIR=<dir>` (resolved against `app/`) names
another, which is refused unless `ALLOW_DATASET_DIR=1` is also set, so a stray
variable can never publish other data. Every build logs the directory it read
and records it in `dist/build.json`.

Before writing, the prerender deletes everything it generates (`dist/r`,
`dist/feeds`, `dist/data`, `dist/feed.xml`, `dist/build.json`, the route pages
and `404.html`), so `npm run prerender` on its own can never leave a stale
record page or feed behind.

## Data

The raw dataset lives in `dataset/entries.json` and `dataset/corrections.json`,
outside `public/`, so Vite never copies it into `dist/`. The build writes the
**public** dataset to `dist/data/entries.json`: only approved, rubric-passing
records whose `first_published_at` is set and not after build time. Leads
(grade 5) and retracted records stay in it, labelled by their own fields.
Drafts (`approved_by: null`) and approved records not yet published are held
back quietly (named only in the build log): no dataset entry, no record page,
no feed entry. Each public record is a projection of the validated record:
schema fields only (`src/build/project.ts`; an unknown key in the raw file never
ships), with `related_ids` limited to public records. Everything else that fails is a build error, not a silent drop:
a duplicate id anywhere in the raw file (checked before approval, so a draft
can never stand in for its approved twin), and any approved record that fails
validation or the rubric, or whose root is not public. In development, Vite serves the raw files
at `/data/*.json` (an inline plugin in `vite.config.ts`) and the page lists
rejected records with their reasons; a production page says nothing about
them. The build log lists them.

### The review queue (development only)

`npm run dev`, then open `http://localhost:5173/review`. The editor's queue of
unapproved records is served by Vite's dev server only
(`scripts/review-middleware.mjs`, installed by `vite.config.ts` with
`apply: 'serve'`); nothing in the app imports it, and the build verifies that
none of it reaches `dist/`. Its API:

- `GET /__review/queue`: every unapproved record with its validation and lint
  results (the build's own validator and lint, via `src/review/core.ts`) and
  the progress line.
- `POST /__review/approve {id}`: approve through `src/data/approve-core.ts`,
  the same function `npm run approve` uses; an invalid record is refused.
- `POST /__review/reject {id, reason}`: clear approval and append
  `{id, reason, at}` to `dataset/rejections.json`.
- `POST /__review/edit {id, patch}`: apply editable fields and clear approval.

Every write re-reads the file, writes atomically (temp file, then rename),
re-validates and returns the record's new state; writes are serialised. The
queue and the raw `/data/*.json` routes answer loopback clients only, refuse a
non-loopback `Host` header (DNS rebinding), and refuse cross-origin or
non-JSON POSTs. `npm run review-smoke` runs the whole API against a temporary
copy of the dataset, including a request from the machine's LAN address.

### Approval

Approval is bound to content (docs/schema.md § Admission controls). A record
is approved only when `approved_by` equals the editor named in `editor.json`
("Sam Vangelos") **and** `approved_digest` equals the SHA-256 of the canonical
JSON (sorted keys) of the record's schema fields, the two approval fields
excluded (`src/data/approval.ts`; the hash is a pure-TypeScript SHA-256 in
`src/data/sha256.ts`, checked against `node:crypto`). Any edit after approval
changes the digest, and the build fails, naming the record, until it is
approved again. A record that names another approver, or the editor without a
digest, also fails. Records with `approved_by: null` are drafts.

```sh
npm run approve -- p-2025-01-self-01 p-2025-02-crypto-02   # validate, then write approved_by + approved_digest
npm run approve -- --correction 0                          # approve corrections.json entry #0
npm run approve -- --check                                 # list every approval that no longer matches (exit 1 if any)
```

Corrections are approved the same way: `approved_by` plus an
`approved_digest` over `record_id`, `date`, `field`, `old_value`, `new_value`
and `reason`. A correction's `field` must be a schema path (`summary`,
`actors[0]`, `amounts[0].usd`, `sources[1].archive_url`,
`actor_roles.<name>`); drafts (`approved_by: null`) are never published; and
any correction, draft or not, whose text contains the id of a record that is
not public fails the build. `dist/data/corrections.json` holds approved
corrections only.

The tool refuses to approve an invalid record. It uses the same dataset
resolver as the build. The fixture's approved records were approved with it.

The app loads `/data/entries.json`, a JSON array of records following dataset
schema v2 (`docs/schema.md`, mirrored field for field in `src/types.ts`), and
`/data/corrections.json`, the corrections log. The loader
(`src/data/load.ts`) validates every record and skips, with a stated reason,
any record that fails: unknown enum values, an evidence grade outside 1 to 5,
a figure without `amount_type`, `actual_or_estimated` or `basis`, a source
without `archive_url`, `approved_by: null` (not in the public dataset), a
missing `first_published_at`, a record naming only private actors below grade
3 or without a recorded response, or a child whose `root_id` does not name a
root in the file. Validation also enforces the schema's admission controls: `actors` is a
non-empty array of distinct, non-blank names with a role for each, and
`entities` and `offices` are arrays of non-blank names (malformed values fail;
nothing is coerced); every record has at least one source, and grade 1 needs a
court filing or official report (or an admission), grade 2 a disclosure, court
filing, official report or congressional record, grade 3 an investigation, and
grade 4 two sources from distinct outlets; `date` is on or after 2025-01-20;
and the summary passes the language lint (`src/data/lint.ts`): it opens with
its grade's verb ("Documented:", "Alleged (corroborated):") or uses it within
its first eight words, and below grade 1 it contains no guilt phrase
("committed", "is guilty", "is a criminal", "bribed", "stole", "defrauded",
"embezzled", "laundered") unless "reported", "alleged", "documented" or
"according" appears within the six words before it. For an approved record,
any of these failures stops the build. Schema v1 records (a single `status`, a `dollar_amount_usd`)
are rejected with a message saying to migrate them; a file that is entirely
v1 shows only that message.

The metric set follows the schema's counting rules (docs/schema.md, clarified
on main): a record is *qualifying* when its `evidence_grade` is 1 to 4, its
`evidentiary_status` is not `retracted`, `approved_by` is set, and
`first_published_at` is set and not in the future. The event count is the
number of trees (a root plus its children) holding at least one qualifying
record, so a qualifying child under a grade-5 or retracted root still makes
one event. The rule text lives verbatim in `src/method.ts` and the arithmetic
in `src/data/metrics.ts`. A record dated for future publication is not public
at all until a build after that time.

The files in `dataset/` are a **placeholder fixture**: every title
starts with `[PLACEHOLDER]`, every source and archive URL points at
`https://example.com/`, every record has `"placeholder": true`, and every name
is invented. The raw file holds 25 records; 22 reach the public dataset (two
unapproved drafts, one of which would also fail the private-actor rule, and
one record scheduled for publication in 2099 are held back). Among them: three
parent/child trees plus a grade-5 lead root with a qualifying child, three
grade-5 leads in all, one retracted record, and figures of each
`amount_type`. They
count 18 qualifying records concerning 14 distinct events (a rule that counted
only qualifying roots would say 13). Its `first_published_at` times cluster in
the week to 13 October 2026 so the cadence strip and `/recent` have something
to show; as the calendar moves on they empty out, which is the behaviour real
data would have on a quiet week. The app shows a notice whenever any loaded
record carries the placeholder flag.

## Using it

- **Headline** (top of the page): "X qualifying records concerning Y distinct
  events since 20 January 2025", beneath it "One new distinct qualifying event
  every N hours on average.", and a "How we count" link to the methodology. Beside it, four counters: days since
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
- `/subscribe` the Atom feeds, listed with their addresses from
  `dist/feeds/index.json`, which the build writes, so the list always matches
  the feed files and never depends on the reader's clock.
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
