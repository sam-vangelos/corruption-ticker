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

The app loads `/data/entries.json`, a JSON array of entries following
`docs/schema.md` (mirrored in `src/types.ts`). Records that fail validation are
skipped and listed in a notice at the top of the page. If the file is missing,
empty, or unreadable, the page says so and shows nothing else.

The file shipped in `public/data/entries.json` is a **placeholder fixture**:
every title starts with `[PLACEHOLDER]`, every source points at
`https://example.com/`, and every record has `"placeholder": true`. The app
shows a notice whenever any loaded record carries that flag. Replace the file
with the real dataset to remove it.
