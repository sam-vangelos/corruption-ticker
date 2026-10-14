## Findings

### 1. Critical — approval is a self-asserted string, not an authorization

[app/src/data/load.ts:113](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/load.ts:113)

> `if (!nonEmpty(o.approved_by)) return { code: 'unapproved', ... };`

[app/src/data/metrics.ts:20](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/metrics.ts:20)

> `&& !!e.approved_by`

Any nonblank value carries the same authority as the named editor. I changed an unpublished draft to `approved_by: "pending review"` and gave it a past publication time. The build succeeded, created its dataset row and record page, added it to three feeds, and changed the headline from 18 records/14 events to 19 records/15 events.

An existing approval also survives arbitrary later edits because it is not bound to the approved content. A previously approved record can be rewritten to name another person without invalidating the approval.

Require approval from an authorized identity and bind it to the exact projected record version or digest. The display string cannot itself be the authorization.

### 2. Critical — corrections are an unrestricted second publication channel

[app/src/build/site.ts:223](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/build/site.ts:223)

> `if (!byId.has(c.record_id)) fatal.push(...)`

[app/src/build/site.ts:239](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/build/site.ts:239)

> `files.push({ path: 'data/corrections.json', content: ... });`

[app/src/build/atom.ts:52](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/build/atom.ts:52)

> `const notes = correctionsFor(corrections, it.id).map(correctionSentence).join(' ');`

A correction only has to name some public record. Its `field`, `old_value`, `new_value`, and `reason` need not describe that record or previously public content.

I attached a correction to a public record whose old value was an unpublished draft’s title and whose reason named the draft ID and a private person. The build succeeded and emitted the hidden material in `data/corrections.json`, the public record page, the main feed, and its office and category feeds.

Corrections need their own approval gate, valid schema field paths, and evidence that the old value was actually public history. The build must also reject references to known nonpublic records before emitting any file.

### 3. High — lossy actor parsing bypasses the private-person rubric

[app/src/data/load.ts:17](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/load.ts:17)

> `const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : []);`

[app/src/data/load.ts:154](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/load.ts:154)

> `if (actors.length > 0 && actors.every((a) => PRIVATE_ROLES.includes(actorRoles[a] as ActorRole))) {`

Malformed actor data is repaired instead of rejected. `actors: "Jane Doe"` becomes an empty list, so the private-person test never runs. An otherwise valid array can also be padded with `""` assigned the `public-official` role; empty strings pass `strList`, and `every(...)` becomes false.

Both attacks let a grade-4 record with a null response name a private person in its title and reach the dataset, record page, and feeds. They also violate the rule that an approved schema-invalid record must fail the build.

Reject non-arrays, blank names, duplicates, and absent actor lists instead of coercing them.

### 4. High — a qualifying record may have no evidence at all

[app/src/data/load.ts:170](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/load.ts:170)

> `if (!Array.isArray(o.sources)) return 'missing sources';`

[app/src/data/load.ts:172](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/load.ts:172)

> `for (const [i, s] of o.sources.entries()) {`

An empty array passes because the loop is vacuous. Evidence grades are otherwise accepted solely as enum values.

I changed a published record to grade 4 with `sources: []`. The build succeeded, counted it, created its page, and placed it in the main, office, and category feeds. A one-source grade-4 record or two copies of the same outlet also passes despite the published independent-corroboration rule.

Require at least one source for every public record and structured, grade-specific support for grades whose definitions require multiple independent sources or witnesses.

### 5. High — the substantive inclusion rubric and first-term exclusion are self-declared

[app/src/data/load.ts:123](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/load.ts:123)

> `if (!isStr(o.date) || !DAY_RE.test(o.date)) return ...`

[app/src/data/load.ts:130](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/load.ts:130)

> `if (!oneOf(RUBRIC_PRONGS, o.rubric_prong)) return ...`

[app/src/data/load.ts:131](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/load.ts:131)

> `if (!nonEmpty(o.rubric_evidence)) return 'missing rubric_evidence';`

The validator checks that a permitted prong and some prose exist, not that the facts satisfy the prong. It also validates only the shape of `date`, despite the explicit exclusion of 2017–2021 conduct.

I changed a qualifying record’s event date to `2019-02-01`; it still reached every public channel and remained in the headline. A policy disagreement can likewise declare `rubric_prong: "abuse-of-office"` and use any nonempty sentence as `rubric_evidence`.

The deterministic exclusion should be enforced in code. Substantive prong approval needs a separate, content-bound editorial decision; the record’s own assertion is not an independent gate.

### 6. High — prohibited assertions about named people pass unchanged

[app/src/data/load.ts:196](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/load.ts:196)

> `summary: isStr(o.summary) ? o.summary : '',`

[app/src/build/atom.ts:58](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/build/atom.ts:58)

> `it.summary,`

The summary is type-checked but not checked against the grade’s required verb or the prohibition on asserting criminal conduct below grade 1.

I gave a grade-4 record the summary “Jane Doe committed bribery and is a criminal.” The build copied it into the downloadable dataset, record page, main feed, and scoped feeds. Displaying a correct grade badge elsewhere does not cure the prohibited sentence.

Approval must cover the exact final text. Add deterministic lint for the assigned verbs and prohibited criminal assertions, backed by human review for statements a lexical check cannot classify safely.

### 7. Medium — the smoke test repeats the vulnerable predicates and is not a build gate

[app/scripts/smoke.mjs:279](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/scripts/smoke.mjs:279)

> `const failsRubric = (e) => {`

[app/scripts/smoke.mjs:286](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/scripts/smoke.mjs:286)

> `const secret = raw.filter((e) => !e.approved_by || failsRubric(e) || unpublished(e));`

[app/package.json:8](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/package.json:8)

> `"build": "tsc --noEmit -p tsconfig.json && vite build && node scripts/prerender.mjs"`

The supposedly independent oracle recognizes only the same private-actor special case. It treats `"pending review"` as approval and considers zero-source, first-term, policy-only, and editorially prohibited records public. The documented production build does not run the smoke test at all.

Each attack above therefore either passes both implementation and oracle or bypasses the oracle entirely. Add adversarial fixtures for every publication gate and make them part of the actual publication workflow.

### 8. Medium — the average interval is calculated per event but described as per record

[app/src/data/metrics.ts:51](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/metrics.ts:51)

> `intervalHours: events > 0 ? hours / events : null`

[app/src/components/Headline.tsx:39](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/components/Headline.tsx:39)

> `One new qualifying record every ... hours on average, counted over distinct events.`

For one event tree containing ten qualifying records, the displayed interval is `hours / 1`, while the sentence calls it a record rate; a record rate would be `hours / 10`. The arithmetic follows the published event rule, but the headline states a different metric.

Change “qualifying record” to “distinct qualifying event.”

## Attacks that failed

- A literal `approved_by: null` draft is excluded, and null or future publication times are withheld at [load.ts:113](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/load.ts:113) and [site.ts:199](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/build/site.ts:199).
- A draft and approved record sharing an ID are both rejected before approval is considered at [load.ts:257](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/load.ts:257).
- A published child cannot survive without a public root; the build makes that fatal at [site.ts:207](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/build/site.ts:207).
- Unknown raw keys are dropped, and `related_ids` pointing to drafts are filtered at [project.ts:14](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/build/project.ts:14) and [project.ts:55](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/build/project.ts:55).
- Stale record pages, feeds, and datasets are removed before regeneration at [prerender.mjs:99](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/scripts/prerender.mjs:99).
- Grade-5 and retracted records stay out of feeds and headline counts, and event counting correctly deduplicates by tree at [site.ts:309](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/build/site.ts:309) and [metrics.ts:43](/Users/sam.vangelos/Projects/personal/corruption-ticker-wave-2/app/src/data/metrics.ts:43).
- Path traversal and markup injection through record IDs or rendered text are blocked by the ID restriction, HTML escaping, and XML escaping.

**Verdict:** the record/event arithmetic is correct for the records admitted, but the admission controls do not establish the promised “never.” Do not publish until findings 1–7 are closed; correct finding 8 before presenting the interval as a headline metric.

Prose sweep: removed repetitive labels and kept each failure scenario beside the line that permits it.