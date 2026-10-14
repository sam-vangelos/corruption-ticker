# Dataset schema (v2)

Revised 2026-10-13 after outside counsel review (`plans/counsel/2026-10-13-codex-concept-review.md`). v1 entries are migrated by a classification pass that assigns the new fields; nothing is published until migration and editor approval.

Each entry in `data/entries.json` is one *record*: a discrete, dated, sourced claim or development. Records form a tree: one **root** record per distinct underlying matter, and **child** records for later developments in that matter.

```json
{
  "id": "2025-01-17-trump-meme-coin-launch",
  "root_id": null,
  "date": "2025-01-17",
  "date_precision": "day | month",
  "title": "Short headline (<= 90 chars)",
  "summary": "2-4 sentence neutral summary. Verbs match the evidence grade: 'alleged', 'reported', 'documented', 'found'.",
  "category": "self-enrichment | foreign-emoluments | crypto | pardons-clemency | pay-to-play | nepotism-cronyism | contracts-procurement | oversight-retaliation | abuse-of-office | conflicts-of-interest | misuse-of-funds",
  "rubric_prong": "private-gain | abuse-of-office",
  "rubric_evidence": "One sentence: which fact satisfies the prong.",
  "actors": ["Donald Trump"],
  "actor_roles": {"Donald Trump": "public-official | family | private-associate | private-entity"},
  "entities": ["Trump Organization"],
  "offices": ["Executive Office of the President"],
  "evidence_grade": 1,
  "evidence_note": "Why this grade: e.g. 'OGE finding dated 2025-03-04' or 'NYT and WSJ independently reported, both citing the SEC filing'.",
  "evidentiary_status": "finding | documented | corroborated | alleged | retracted",
  "procedural_status": "none | under-investigation | litigation | resolved | dismissed",
  "subject_response": "denied | no-comment | admitted | not-sought | retracted-by-outlet | null",
  "status_note": "Latest known development, or null",
  "amounts": [
    {
      "usd": 12500000,
      "amount_type": "private-benefit | public-funds | face-value | exposure",
      "actual_or_estimated": "actual | estimated",
      "basis": "What the number represents and who reported it.",
      "overlap_group": "meme-coin-revenue"
    }
  ],
  "sources": [
    {"outlet": "The New York Times", "title": "...", "url": "https://...", "archive_url": "https://web.archive.org/...", "date": "2025-01-18", "author": "...", "kind": "news | investigation | court-filing | official-report | disclosure | congressional"}
  ],
  "first_published_at": null,
  "last_modified_at": null,
  "last_verified_at": "2026-10-13T00:00:00Z",
  "approved_by": null,
  "related_ids": [],
  "tags": []
}
```

## Evidence grades

| Grade | Meaning | Counts in metrics |
|---|---|---|
| 1 | Adjudicated or official finding (court judgment, IG/GAO/OGE finding, admission) | yes |
| 2 | Primary records establishing the material facts (filings, disclosures, contracts, FOIA documents) reported on by a journalistic outlet | yes |
| 3 | Document-based journalistic investigation | yes |
| 4 | Allegation independently corroborated by two or more unrelated outlets or witnesses | yes |
| 5 | Single-source allegation | no; retained as a lead |

Outlet identity is recorded in `sources[].outlet` and `sources[].kind` and is never the inclusion gate. `docs/sources.md` lists outlets only to help researchers find reporting; it confers no grade.

## Inclusion rubric

Include when BOTH hold:
1. **Prong.** The record concerns use of public office, or proximity to it, for private gain (`private-gain`), OR abuse of office to punish oversight, reward allies, or evade accountability (`abuse-of-office`). `rubric_evidence` names the fact.
2. **Evidence.** Grade 1 to 4 to count in metrics; grade 5 may be stored as a lead. Records whose actors are only `family`, `private-associate` or `private-entity` require grade 3 or better.

Exclude: policy disagreements, pure opinion, unsourced social-media claims, first-term (2017-2021) conduct unless a 2025+ development exists (then the 2025+ development is the record).

## Counting rules (published beside the headline)

- Event count = number of root records with `evidence_grade` 1 to 4 and `evidentiary_status` not `retracted`.
- Record count = all root and child records meeting the same filter.
- Average interval = hours since 2025-01-20T12:00:00-05:00 divided by event count.
- Financial stakes = per `amount_type`, sum of `usd` over records in the metric set, counting each `overlap_group` once (largest figure wins). No grand total.
- Event dates are `date`; the seven-day cadence strip uses `first_published_at`.

## Editorial rules

- Summaries are neutral and attributive. The verb matches the grade: grade 1 "found", grade 2 "documented", grade 3 "reported", grade 4 "alleged (corroborated)", grade 5 "alleged".
- The record never asserts that a person committed a crime unless grade 1 establishes it.
- Every figure has an `amount_type`, `actual_or_estimated`, and `basis`.
- `date` is `YYYY-MM-DD`; month-precision uses the 1st with `date_precision: "month"`. `date` is the conduct or first-report date, never the ledger date.
- Status is three fields; "latest known development" lives in `status_note`.
- Every source URL is archived at verification; `archive_url` is required for publication.
- `approved_by` is the named editor; a record with `approved_by: null` is not in the public dataset.
- Post-publication edits append to `data/corrections.json` with date, record id, field, old value, new value, reason.
