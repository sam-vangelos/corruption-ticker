# Concept v2: a living public record of sourced allegations, findings, and oversight changes

Working title: **The Ethics Record**. Deck: "Sourced allegations, findings, and oversight changes in the second Trump administration." Clearance (trademark, publication titles, handles) still to run; no purchase yet.

Revised 2026-10-13 after outside counsel (Codex GPT, `plans/counsel/2026-10-13-codex-concept-review.md`). What changed and why is in the last section.

## The goal, in Sam's words

Build a mechanism that lets people quickly and intuitively grasp the frequency, scale, pervasiveness and corrosiveness of corruption in the second Trump administration, in a way that allows for virality without being gimmicks. Sam's name goes on it. Code and data are published openly. Nothing is bought yet.

## The thesis

A ticker is a reader. A record is something people cite. The thing to build is a living, open, evidence-graded public record whose front page states one honest number and whose instruments each make one of the four words legible in seconds. What spreads is credibility plus specificity: a permanent receipt for every entry, a dataset journalists and researchers can download and audit, subscriptions that bring readers back, and a public corrections log. The record never calls a person corrupt. It states what was reported, by whom, with what evidence, and what happened next.

## The headline

"**X qualifying records concerning Y distinct events since 20 January 2025.**" Both counts come live from the dataset. Beneath it, the average cadence stated as what it is: "one new distinct qualifying event every N hours on average," computed over event trees, with the counting rules one click away. No "acts of corruption," no "K a week" presented as current cadence, no "since you opened this page" counter.

Counting rules, published beside the number: one root event per distinct underlying matter; developments in a matter are child records that do not increase the event count; retracted records are excluded from all metrics; records at evidence grade 5 (single-source allegation) are retained as leads and excluded from all metrics; the event count uses the date of the underlying conduct or first report, never the date the record was added.

## The instruments

1. **Frequency: the cadence.** The headline counts and the average interval. A seven-day strip beneath shows records added in each of the last seven days, labelled as additions to the record, kept visually separate from event dates.
2. **Pervasiveness: the map of the government.** Every cabinet department, major agency and White House office as a tile on an org-chart layout, lit by count of root events. Family members and private associates are not on the government chart; they get a separate relationships view that shows which official or office each private actor is connected to. Each tile carries its count and its evidence-grade mix, so a tile lit by one official finding reads differently from a tile lit by five corroborated allegations. The denominator problem (big agencies get more coverage) is addressed by showing counts, never rates, and by publishing the search universe and the exclusion log.
3. **Scale: financial stakes.** No grand total. Separate, non-overlapping rows, each with its own subtotal and entry count: documented private benefit received; public funds disbursed; contract or asset face value; estimated or potential exposure; entries with no defensible amount. Every figure keeps its basis. Overlap groups prevent a parent and its children from being summed twice. No comparison cards.
4. **Corrosiveness: who's left to watch.** Every inspector general, ethics office, independent commission seat and oversight role as a light. Lights that went dark since 20 January 2025 are shown dark with the date and the reported reason. The instrument states what happened to oversight; it does not claim that oversight loss caused the other counts.

The stream, filters, charts and detail drawer already built in app v1 remain as the archive beneath the instruments.

## Virality without gimmicks

- **Receipts.** Every record has a permanent URL whose link preview is rendered on demand from current data: date, one-line headline, evidence grade, outlet or document, the figure and its type if any, current status, and a correction notice if one exists. A posted link therefore updates when the record does; no baked image outlives a retraction.
- **Citation.** Every release publishes a recommended citation and a versioned, frozen dataset URL, so a journalist can footnote a fixed number rather than the live one.
- **Subscriptions.** Email and RSS/Atom feeds, filterable by agency, actor and category, plus a weekly digest of status changes and corrections. This is what brings readers back; share cards and downloads alone are destinations.
- **Daily review, not daily publication.** `/recent` lists what was added or changed in the last 24 hours, with timestamps. Quiet days stay quiet.
- **Open data.** Full dataset as JSON and CSV, versioned at a stable URL, with the rubric, the evidence grades, the counting rules, the search universe, the candidate-and-exclusion log, and a changelog.
- **Embeds.** The headline and any one instrument as an embeddable iframe. Every embed carries the counting-rules link; the bare number is never embeddable on its own.
- **Corrections page.** Public, dated, every post-publication change to a record.

Explicitly out: games, leaderboards, countdowns, AI-generated imagery, comparison cards, a grand dollar total, any phrasing that asserts a person committed a crime.

## Credibility rules (product-level; the schema carries the field definitions)

- **Evidence grades, assigned per claim, replace outlet tiers.** 1 adjudicated or official finding; 2 primary records establishing the material facts; 3 document-based journalistic investigation; 4 independently corroborated allegation; 5 single-source allegation, kept as a lead and excluded from metrics. Outlet identity is recorded, never used as the gate.
- **Three status fields, not one.** Evidentiary status (what the evidence establishes), procedural status (investigation, litigation, resolved), subject response (denied, no comment, admitted, retracted by outlet).
- **Every record states the rubric prong it satisfies and the evidence for it.**
- **A named human editor approves every record before publication.** Machines find leads, draft entries, and verify sources; Sam approves. Nothing reaches the public dataset without that approval.
- **Counsel reviews the methodology, every record that names a private person or states a crime, and a sample of the rest.** Not every release. The question "can a hostile reader find a false entry?" is an audit prompt, not a gate; at scale the honest answer is sometimes yes, and the corrections page is the answer to that.
- **Language.** "Reported," "alleged," "found," and "documented" are used according to the evidence grade and never interchangeably. Public-official status does not cover family members and private entities, and California recognises no neutral-reportage privilege for private figures (Khawar v. Globe International), so entries about them are held to grade 3 or better and must record a subject response (sought and received, or sought and declined).

## The living part

A scheduled daily job (Sonnet 5.5 researchers, Opus 5.5 source verifier) sweeps the last 48 hours of reporting, proposes records against the rubric, verifies sources, and places them in a review queue. Sam approves, edits, or rejects from the queue; approved records publish with `first_published_at`. The job re-checks procedural status weekly for anything in investigation or litigation and logs every change. Every source URL is archived at verification time and stored beside the original.

## Waves

1. Dataset, source-verified, migrated to schema v2 (evidence grades, amount types, timestamps, status split), then the editor's first approval pass. (Research running; the public app shows only placeholder data until approval.)
2. Front page: the headline counts, the cadence, receipts, `/recent`, subscriptions.
3. The map, the relationships view, financial stakes, who's left to watch.
4. Open data with the methodology pages, embeds, corrections page, the daily review queue, launch on a free host.

Each wave: plan, counsel attacks the plan, Opus 5.5 implementers build, Sonnet and Haiku 5.5 lenses review, counsel reviews the result, principal verifies and ships a preview, Linear logged.

## Risks

- **Accuracy and defamation.** Named people, Sam's name on it, and "reported" is not a shield (Ray v. Citizen-News; Milkovich). Mitigation: evidence grades, the editor's approval gate, grade-matched language, the corrections page, grade 3 or better for private persons.
- **Perceived partisanship.** Mitigation: the rubric is public and evidence-based rather than outlet-based; the data and the exclusion log are downloadable; no outlet is privileged by brand.
- **The authored numerator.** Mitigation: root-event counting, published rules, child records excluded from the event count.
- **Sam's employment exposure.** His decision; noted.
- **Link rot.** Archive at verification.
- **Editor bottleneck.** The approval gate is real work for Sam. Mitigation: batch the queue, rank by evidence grade, show the verifier's evidence inline so approval is a read, not a search.

## What changed from v1 and why

Counsel's attack on the headline held: "one reported act of corruption every N hours" turned allegations into acts and let the editor's row-splitting set the rate. The headline is now two counts and an average with published rules. The odometer summed non-additive quantities and is replaced by non-overlapping financial-stakes rows with no total. Outlet tiers graded publishers instead of evidence and produced a partisan screenshot by construction; evidence grades replace them. Family members leave the government chart. The causal line about oversight is gone. Daily publication becomes daily review. The final gate is a named human, not a model. Subscriptions are added because nothing in v1 brought a reader back. The name changes because the alternatives were taken or implied proof. Counsel's suggestion to cut the running dataset was declined: the research continues, it simply publishes nothing until it passes migration and approval.
