# Concept: a living public ledger of reported corruption

Working title: **The Running Tab**. Alternatives for counsel to weigh: The Ledger, Receipts, Public Record.

## The goal, in Sam's words

Build a mechanism that lets people quickly and intuitively grasp the frequency, scale, pervasiveness and corrosiveness of corruption in the second Trump administration, in a way that allows for virality without being gimmicky. Sam's name goes on it. Code and data are published openly. Nothing is bought yet.

## The thesis

A ticker is a reader. A record is something people cite. The thing to build is a living, open, source-verified public record whose front page states one number nobody can un-see and whose four instruments each make one of the four words legible in under five seconds. Everything that spreads comes from credibility plus specificity: a permanent receipt for every entry, a dataset that journalists and researchers can download and audit, and a daily update so the record is alive and gets checked every morning.

## The headline number

"One reported act of corruption every N hours since 20 January 2025." Derived live from the verified dataset: elapsed hours since inauguration divided by entry count. A second line restates the rate at a human scale: "That is K a week. L this month." No "since you opened this page" counter, because at a rate of hours per item it would sit at zero and read as a trick. The number is only as strong as the dataset's inclusion rubric, which is why the rubric and the source tiers ship on the page one click away.

## The four instruments

1. **Frequency: the clock.** The headline number, counting. A strip beneath it shows the last seven days as seven columns of marks, so a reader sees that the cadence is not a historical average but this week.
2. **Pervasiveness: the map of the government.** Every cabinet department, major agency, White House office, and family member as a tile on an org-chart layout. Each tile carries its count and lights by density. The reader's eye does the argument: it is not one man, it is the chart. Hover or tap a tile to see its entries.
3. **Scale: the odometer.** Total reported dollars across entries that carry a figure, with the basis for every figure one click away and the count of entries that carry no figure stated beside it. Three comparisons chosen for size, not for a punchline (for example the annual budget of a named federal agency, a named state's annual education spend, the median household's lifetime earnings), each with its own source.
4. **Corrosiveness: who's left to watch.** Every inspector general, ethics office, independent commission seat, and oversight role as a light. Lights that went dark since 20 January 2025 are shown dark with the date and the reported reason. This instrument is the one that explains why the other three keep rising.

The stream, filters, charts and detail drawer already built in app v1 remain as the archive beneath the instruments.

## Virality without gimmicks

- **Receipts.** Every entry has a permanent URL and an auto-generated share card (date, one-line headline, outlet, the dollar figure if any, the ledger's name). The card is plain, typeset, and carries the source. It is the unit that travels.
- **Daily page.** "/today" lists what was added in the last 24 hours. A daily card summarises it. This is what people share on a schedule.
- **Open data.** The full dataset as JSON and CSV, with the rubric, the source tiers, and a changelog. A stable URL per version. Being the dataset others cite is the strongest distribution there is.
- **Embeds.** The clock and any one instrument as an embeddable iframe for newsletters and sites.
- **Corrections page.** Public, dated, every change to an entry after publication. Credibility is the product.

Explicitly out: games, outrage leaderboards, countdowns, AI-generated imagery, comparisons engineered for a punchline, anything that would make a hostile reader's first screenshot look like a meme rather than a record.

## Credibility rules (already in docs/schema.md and docs/sources.md, restated as product rules)

Every entry cites a Tier-1 outlet or a primary document reported on by one. Summaries are attributive and neutral. Status reflects the latest known development, including "disputed" and "retracted". Every dollar figure carries its basis. Items that fail verification are dropped, not caveated. A fairness audit by outside counsel runs before every public release and asks one question: can a hostile, numerate reader find a false or unfair entry?

## The living part

A scheduled daily job (Sonnet 5.5 researchers, Opus 5.5 verifier) sweeps the last 48 hours of reporting, proposes entries against the rubric, verifies them, and opens a review. Nothing goes live without passing verification. The job also re-checks the status of entries marked under-investigation or in litigation once a week.

## Waves

1. Dataset, fact-checked, plus the daily ingest. (Running.)
2. The ledger front page: the clock, the headline number, receipts, the daily page.
3. The map, the odometer, the watchdog lights.
4. Open data, embeds, corrections page, launch on a free host (no purchases).

Each wave: plan, counsel attacks the plan (fairness and concept), Opus 5.5 implementers build, Sonnet/Haiku 5.5 lenses review, counsel reviews the shipped result, principal verifies and ships a preview, Linear logged.

## Risks

- **Accuracy and defamation.** Named people, Sam's name on it. Mitigation: the rubric, the verification gate, the corrections page, "reported by" framing throughout, no editorialising.
- **Perceived partisanship.** Mitigation: the inclusion rubric is public and mechanical; the data is downloadable; the fairness audit is adversarial by design; the page never uses the word "corrupt" about a person, only "reported".
- **Sam's employment exposure.** His decision; noted.
- **Link rot.** Archive every source URL at the time of verification (Wayback) and store the archive link beside the original.
- **Dataset drift.** Weekly status re-checks; version the dataset.

## Questions for outside counsel

1. Does the headline number survive a hostile reading? What is the strongest attack on it?
2. Which of the four instruments is weakest, and what replaces it?
3. What is missing from the virality plan that is not a gimmick?
4. What is the single biggest credibility hole in the rubric and the source tiers?
5. Name: The Running Tab, The Ledger, Receipts, Public Record, or something better?
