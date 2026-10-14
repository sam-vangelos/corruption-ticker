## 1. Headline number

No. The arithmetic may be reproducible; the sentence is not defensible.

The schema defines a row as a “reported item” that may be either an “allegation or finding” ([schema](/Users/sam.vangelos/Projects/personal/corruption-ticker/docs/schema.md:3)). The headline converts every row into a “reported act of corruption” ([concept](/Users/sam.vangelos/Projects/personal/corruption-ticker/plans/concept.md:15)). That silently turns allegations, disputed matters, litigation updates, and potentially retracted reports into acts that occurred.

The strongest attack is: “This measures how the editor split selected news coverage into database rows, not how often corruption occurred.” The parent-plus-child rule makes that attack easy; splitting one saga into five updates improves the advertised rate fivefold. One `date` field also conflates the conduct, report, procedural development, and ledger publication. The example entry is dated January 17, three days before the clock begins, while the rubric admits older conduct with a “new 2025+ development.”

Lead with: **“X qualifying reports concerning Y distinct events since January 20, 2025.”** If a rate remains, call it “one new qualifying record every N hours on average,” count root events only, exclude retractions from active metrics, and publish the count rules beside the number. Cut “K a week”; it disguises a cumulative average as current cadence.

“Reported” is not a legal talisman. California authority expressly rejects the idea that a defamatory charge becomes safe merely because it is styled as “reported or asserted,” and *Milkovich* rejects categorical protection when language implies provable facts. [*Ray v. Citizen-News Co.*](https://law.justia.com/cases/california/court-of-appeal/2d/14/6.html), [*Milkovich v. Lorain Journal Co.*](https://www.govinfo.gov/content/pkg/USREPORTS-497/pdf/USREPORTS-497-1.pdf)

## 2. Weakest instrument

The odometer. “Total reported dollars” adds quantities that are not economically interchangeable: private benefit, public expenditure, contract face value, asset valuation, avoided cost, estimated exposure, and alleged loss. A disclosed `dollar_basis` explains each number but does not make them additive. Parent and child entries also create obvious double-counting risk.

Replace it with a **Financial stakes** panel containing separate, non-overlapping rows:

- Documented private benefit received
- Public funds disbursed
- Contract or asset face value
- Estimated or potential exposure
- Entries without a defensible amount

Each row gets its own subtotal and entry count; there is no grand total. Add `amount_type`, `actual_or_estimated`, and `overlap_group` to the schema. Cut the agency-budget and lifetime-earnings comparisons; they are punchlines with citations.

## 3. Missing from the virality plan

A delivery mechanism. `/today`, share cards, embeds, and downloads are destinations; none brings a reader back.

Ship email and RSS/Atom subscriptions, including filtered feeds by agency, actor, and category, plus a weekly status-and-corrections digest. Recruit beat reporters, newsletter writers, librarians, and ethics researchers to test whether they can cite those feeds without assistance.

The schema also needs `first_published_at`, `last_modified_at`, and `last_verified_at`. With only `date`, the product cannot truthfully calculate “what was added in the last 24 hours.”

## 4. Biggest credibility hole

The method grades publishers instead of evidence. “Tier 1 (sufficient alone)” allows one article, court document, or congressional report to establish inclusion ([source tiers](/Users/sam.vangelos/Projects/personal/corruption-ticker/docs/sources.md:3)). A complaint contains allegations, not findings; a congressional report may be partisan; an otherwise reputable outlet may merely repeat either one.

The partisan screenshot is also prewritten: Mother Jones and The Intercept suffice alone, while National Review and Washington Examiner require corroboration. The reader need not prove those outlets equivalent; the asymmetry disproves the claim that the rubric is “mechanical.”

Replace outlet tiers with claim-level evidence grades:

1. Adjudicated or official finding  
2. Primary records establishing the material facts  
3. Document-based journalistic investigation  
4. Independently corroborated allegation  
5. Single-source allegation — retained as a lead, excluded from metrics  

Split the current `status` field into evidentiary status, procedural status, and subject response. Add the exact rubric prong and evidence supporting it to every entry.

Public-official plaintiffs ordinarily face the *Sullivan* actual-malice standard, but the proposed product also names family members and private entities; do not assume every subject receives that classification. [*New York Times Co. v. Sullivan*](https://www.govinfo.gov/content/pkg/USREPORTS-376/pdf/USREPORTS-376-254.pdf)

## 5. Name

Use **The Ethics Record**, with the deck: **“Sourced allegations, findings, and oversight changes in the second Trump administration.”**

- **The Running Tab** is a money pun, narrows the project incorrectly, and is already used by [a current publication](https://mgarciafaria.substack.com/p/the-running-tab-no-001).
- **The Ledger** is generic and already belongs to [an established newspaper](https://www.theledger.com/).
- **Receipts** is internet slang and implies conclusive proof.
- **Public Record** falsely suggests an official or exhaustive record and already has [accountability-publication use](https://thepublicrecord.beehiiv.com/).

Run trademark, common-law publication-title, domain, and social-handle clearance before adoption.

## 6. Strongest attacks from a hostile, numerate reader

| Attack | Does the concept already defend against it? |
|---|---|
| **“The numerator is authored.”** Entry boundaries, parent/child decisions, retractions, and status eligibility determine the rate. | **No.** “One entry per discrete event” supplies no reproducible identity or deduplication rule. |
| **“The map measures press attention, not pervasiveness.”** Large or heavily covered agencies have more opportunities to generate reports; a 48-hour media sweep has no known recall rate. | **Partly.** Open data and a daily sweep expose the sample, but there is no published search universe, candidate-and-exclusion log, missed-case audit, or denominator for agency size and exposure. |
| **“The aggregates erase incompatible evidence.”** A disputed report and an official finding each add one; contract value and alleged private benefit both add dollars. | **No.** Status and `dollar_basis` disclose the incompatibility after aggregation; they do not make either aggregate valid. |

## 7. What to cut

- Cut the odometer, grand total, and all three comparison cards.
- Cut “act of corruption,” “K a week,” and any seven-day display that mixes event dates with ledger-addition dates.
- Cut “explains why the other three keep rising.” Oversight losses may correlate with later events; this product cannot establish that causal claim.
- Cut family members from the government org chart. Put associated private actors in a separate relationship view.
- Cut the outlet-brand tiers and replace them with the evidence grades above.
- Cut the promise of a daily publication. Promise daily review; publishing quotas will pressure the editor to fill quiet days.
- Cut model names and the “Opus verifier” as the final gate. Machines may find leads; a named human editor must approve every entry.
- Cut counsel review “before every public release.” Counsel should approve the methodology, review unusually risky entries, and audit samples.
- Cut “Dataset … (Running.)” for now. The bundled dataset is explicitly placeholder-only, with invented amounts and `example.com` sources ([current data](/Users/sam.vangelos/Projects/personal/corruption-ticker/app/public/data/entries.json:6)); no public metric should touch it.