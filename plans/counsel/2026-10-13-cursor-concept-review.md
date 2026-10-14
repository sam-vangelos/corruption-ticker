The text under review is the concept, schema, and source tiers in your message. The files on disk are a later draft.

## 1. Headline number

The headline fails a hostile reading. It takes "elapsed hours since inauguration divided by entry count" and names the quotient "one reported act of corruption." The schema's row is "a discrete, dated, sourced allegation or finding," and `status` includes `disputed` and `retracted`. That quotient is a filing rate. The sentence calls the filings acts. Putting "reported" in front of them leaves the sentence in your voice. *Ray v. Citizen-News Co.*, 14 Cal. App. 2d 6, 8–9 (1936), held that a charge "does not lose its quality" as libel per se "by the statement that it is reported or asserted or believed to be true." *Milkovich v. Lorain Journal Co.*, 497 U.S. 1, 19 (1990), rejects a separate privilege for wording that still implies a provable fact. The concept's own rule, that the page "never uses the word 'corrupt' about a person, only 'reported,'" is the rule this sentence breaks, because the corruption label is on the count.

The strongest attack is that N measures how you cut coverage into rows. Sagas become "one parent entry plus dated child entries," and the formula divides by "entry count," so each child shortens the interval. The schema's worked example is dated `2025-01-17`, three days before the clock starts, and the rubric still admits first-term conduct once "a new 2025+ development exists," so events from outside the window sit in the rate. "K a week" and "L this month" reprint that cumulative average as a current cadence. The seven-day strip is there so a reader will see that the cadence "is not a historical average but this week," which concedes what the second line is doing. The schema has one `date` and no publication timestamp, so "this month" and `/today` ("added in the last 24 hours") cannot be computed from the fields you plan to publish. The app already implements the average: `computeStats` sets `perWeek` to item count divided by weeks since inauguration.

The number that can survive is two counts and a labeled average: "X qualifying records concerning Y distinct events since 20 January 2025." Take the average over root events only, keep retracted rows out of every metric, and put the counting rules on the same screen as the number.

## 2. Weakest instrument

The weakest instrument is the odometer. "Total reported dollars" adds figures the schema never claims are one kind of thing. `dollar_basis` explains a single number. A private benefit, a contract's face value, a public outlay, and an estimate can each have an honest basis and still refuse to be added. `related_ids` will put the same money on a parent and a child, and the concept sums entries. The three comparisons, "chosen for size, not for a punchline," are a named agency budget, a named state's education spend, and "the median household's lifetime earnings." Lifetime earnings beside a mixed sum is the punchline, with a citation attached. `computeStats` already runs that sum, and the only dataset in the repo feeds it invented amounts, including $12,000,000 on a row whose title begins `[PLACEHOLDER]`.

Replace it with separate financial-stakes rows, each with its own subtotal and its own entry count: documented private benefit received; public funds disbursed; contract or asset face value; estimated or potential exposure; entries with no defensible amount. Give every figure an `amount_type`, an actual-or-estimated flag, and an overlap key that can contribute only once inside its row. Publish no grand total and no comparison card.

## 3. Virality

The plan has places to visit and no way back. A receipt, `/today`, an embed, and a CSV wait for someone to remember them. The thesis says the record "gets checked every morning," and the virality list never arrives the next morning on its own. Add email and RSS/Atom subscriptions, filterable by office, actor, and category, plus a weekly digest limited to status changes and corrections.

The unit that travels has to be the permanent URL, rendered as a link preview that shows the current status, the evidence grade, and a correction if one exists. The concept's card is a baked image: "date, one-line headline, outlet, the dollar figure if any." A retraction updates the row and leaves the image already posted. The schema also needs `first_published_at` before `/today` or the digest can say, truthfully, what was added. Publish a recommended citation and a versioned dataset URL in the same release, so a journalist can footnote a frozen numerator rather than the live one.

## 4. Credibility hole

The hole is that inclusion grades the publisher, grades publishers unequally, and then contradicts the schema on documents. "Tier 1 (sufficient alone)" lets in one story from Mother Jones, The Intercept, or The Hill, and it also lists "Court documents" and "congressional reports" as sufficient alone. A complaint is a court document. A majority staff report is a congressional report. The schema's second prong requires a primary document to be "reported on by" a legitimate outlet. The tier list waives that. National Review, the Washington Examiner, and the New York Post sit in Tier 2 and need corroboration. The concept's answer to a partisanship charge is that the rubric is "public and mechanical." Those two lists are a set of editorial preferences. A hostile reader only has to screenshot them.

Grade the claim. Grade 1 is an adjudicated or official finding. Grade 2 is primary records that establish the material facts. Grade 3 is a document-based investigation. Grade 4 is an allegation corroborated by two outlets that did not both republish the same wire copy. Grade 5 is a single-source allegation, kept as a lead and kept out of every metric. Split `status` into evidentiary status, procedural status, and subject response, and store the rubric prong plus the fact that satisfies it. Without that field, "pardons-clemency" and "proximity to" office will absorb lawful acts the rubric tells you to exclude as policy disagreements.

Proximity is also how private persons enter, and the map puts every "family member" on the government chart. Actual malice under *New York Times Co. v. Sullivan*, 376 U.S. 254 (1964), is the public-official standard. *Khawar v. Globe International, Inc.*, 19 Cal. 4th 254 (1998), holds that California recognizes no neutral-reportage privilege for a private figure. Rows whose actors are family members or private entities need grade 3 or better, and a recorded subject response.

## 5. Name

Use **The Ethics Record**. The deck is "Sourced allegations, findings, and oversight changes in the second Trump administration."

The Running Tab is a bill metaphor, aimed at the instrument in section 2, and the phrase is already a titled piece, including Mutant's "The Running Tab." The Ledger is the Lakeland newspaper at theledger.com. Receipts is slang for proof these grades will often not have reached. Public Record claims an official, exhaustive record. The repo README already makes that overclaim in plainer language: "every corruption-related item."

Clear trademark, common-law title, domain, and handles before you adopt it. The collisions I checked are The Ethical Record, the Ethical Culture periodical of 1888–1904, and The Ethical Record Label, a Liverpool nonprofit. They are a clearance task. They leave the four alternatives behind.

## 6. Three attacks

| Attack | Does the concept defend against it? |
|---|---|
| **The numerator is authored.** Parent and child rows, retractions, and the boundary of "one event" are editorial choices, and the rate divides by entry count. | **No.** "One entry per discrete event" states an intention. The parent-child rule authorizes the split that moves N, and retracted rows stay inside "entry count." |
| **The aggregates erase incompatible evidence.** A disputed allegation and an official finding each add one. A contract face value and an alleged private benefit both add dollars. | **No.** `status` and `dollar_basis` describe the mismatch on the row, after the headline and the odometer have combined them. The current dollar tooltip admits that "separate items may describe overlapping money" and still shows one total. |
| **The map has no denominator.** Tiles light by count. A sweep of "the last 48 hours of reporting" publishes no search universe, no exclusion log, and no missed-case audit, so a large or heavily covered agency draws more light. An empty tile reads as a clean office. | **Partly.** Click-through and open data show the rows you kept. They show nothing about the rows you rejected or the volume of coverage behind each tile. The further claim that the watchdog lights "explain why the other three keep rising" has no method under it at all. |

## 7. What to cut

- "Act of corruption," "K a week," and "L this month," plus any seven-day strip that treats event `date` as the day the record was added.
- The grand total and all three comparison cards.
- The sentence that the lights explain why the other three keep rising. Take family members off the government chart and put private actors in a relationships view tied to an office.
- Outlet tiers as an inclusion gate.
- `/today` as "what people share on a schedule." That is a publication quota. Review every day. Publish when a record passes.
- The model as the last gate. The plan has an Opus verifier, then "nothing goes live without passing verification." A named human approves every record. Counsel reviews the method, any row that names a private person or states a crime, and a sample of the rest. Drop the promise of a counsel pass before every release. The audit question, "can a hostile, numerate reader find a false or unfair entry?", becomes unusable as a gate once the set is large enough that the honest answer is yes.
- Embeds of the bare quotient. An iframe that shows only N is the headline with the rubric removed.
- "Dataset, fact-checked, plus the daily ingest. (Running.)" as a description of this repo. The only `entries.json` is fixture copy, `example.com` URLs, and invented dollars. No public metric should read that file.

Sweep: folded a run of contrast sentences into direct findings, and broke a one-word opener on the odometer into the verdict itself.
