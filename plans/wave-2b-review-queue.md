# Wave 2b build brief: the editor's review queue

Linear: CLO-461 (sub-slice). The named editor must approve every record before publication (`docs/schema.md` § Admission controls). 428 real records are about to arrive. Approving them one id at a time with `npm run approve` is not workable, so the editor needs a queue.

## Goal

A development-only page, `/review`, served by the Vite dev server (never built into `dist`), where the editor reads each unapproved record with its evidence inline and approves, edits, or rejects it. Approval writes `approved_by` and `approved_digest` into the dataset file through the same code path as `scripts/approve.mjs`, so the build's gate is the only gate.

## Ruled out

- Nothing from `/review` may exist in production output. The route, its components, and its dev-server API must be tree-shaken or guarded so `dist` contains no trace; add a verify check that greps `dist` for "review" route markers and the API path.
- No backend beyond Vite's dev server middleware. No auth (it is localhost only; refuse non-loopback requests).
- No AI calls from the queue. The queue displays what the migration produced; it does not generate text.
- Nothing outside `app/`.

## What to build

1. **Dev middleware** in `vite.config.ts` (loopback only): `GET /__review/queue` returns unapproved records with their validation result and lint result (reuse the loader and lint, do not duplicate predicates); `POST /__review/approve {id}` recomputes the digest and writes `approved_by` + `approved_digest` into `app/dataset/entries.json` atomically (write temp, rename); `POST /__review/reject {id, reason}` sets `approved_by: null` and appends `{id, reason, at}` to `app/dataset/rejections.json`; `POST /__review/edit {id, patch}` applies a field patch, clears approval, and re-validates. Every write re-runs validation and returns the record's new state.
2. **The queue page.** One record at a time, keyboard-driven: `a` approve, `r` reject (prompts for a reason), `e` edit, `n`/`p` next/previous, `/` jump to id. Shows, in this order: title; the summary with its grade verb highlighted; evidence grade and `evidence_note`; rubric prong and `rubric_evidence`; actors with roles; every source as outlet, kind, headline, link, archive link; amounts with type and basis; the three statuses and the subject response; validation errors and lint findings in red at the top if any (approval disabled until they are fixed by an edit). A progress line: approved / rejected / remaining, and a filter by month, category, grade, and "has validation errors".
3. **Edit mode.** A form over the schema fields (not raw JSON): text fields for title, summary, evidence_note, rubric_evidence, status_note; selects for the enums; list editors for actors (with role), entities, offices, sources (with kind, url, archive_url), amounts (usd, type, actual/estimated, basis, overlap_group). Save re-validates and re-lints; the record stays unapproved until `a`.
4. **Batch view.** A table of all unapproved records (id, date, grade, category, title, errors count) to triage order; click opens that record in the queue. Bulk approve is deliberately absent.
5. **Archive helper.** For a source missing `archive_url`, a button "request archive" that POSTs to `/__review/archive {url}`; the middleware calls `https://web.archive.org/save/<url>` (GET, follow redirects) and writes the resulting `https://web.archive.org/web/<ts>/<url>` into the source. Rate-limit to one request per 4 seconds; surface failures.

## Gate

`npm run build` (with verify) exit 0 and a new verify check that `dist` contains none of: `/__review`, `review-queue`, the queue component names. `npm run smoke` exit 0. A dev-server test script `scripts/review-smoke.mjs` that starts the dev server, fetches the queue, approves a fixture draft through the API, confirms `approve --check` passes and the record's digest matches, rejects one with a reason, confirms the rejections file, edits one and confirms approval was cleared, and confirms a non-loopback request is refused. Exit codes to `app/.gate/exit-codes.txt`, read back.

## Commit shape

Branch `wave-2` continues (it is fast-forwarded to main). Commits: (1) middleware + API + review-smoke; (2) queue page + keyboard; (3) edit mode; (4) batch view + archive helper + verify check. No merge, no push, no stash.

## Report

Plain prose, file:line, gate exit codes, red-before for the dist-exclusion check (show that an unguarded import would leak), commit SHAs, serving model.
