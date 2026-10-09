# Dataset schema (v1)

Each entry in `data/entries.json` is one *reported item*: a discrete, dated, sourced allegation or finding.

```json
{
  "id": "2025-01-17-trump-meme-coin-launch",
  "date": "2025-01-17",
  "date_precision": "day | month",
  "title": "Short headline (<= 90 chars)",
  "summary": "2-4 sentence neutral summary of what was reported. State who reported it.",
  "category": "self-enrichment | foreign-emoluments | crypto | pardons-clemency | pay-to-play | nepotism-cronyism | contracts-procurement | oversight-retaliation | abuse-of-office | conflicts-of-interest | misuse-of-funds",
  "actors": ["Donald Trump", "..."],
  "entities": ["Trump Organization", "..."],
  "dollar_amount_usd": 12500000,
  "dollar_basis": "What the number represents and where it came from, or null",
  "status": "reported | under-investigation | litigation | confirmed | disputed | retracted",
  "status_note": "Latest known development, or null",
  "sources": [
    {"outlet": "The New York Times", "title": "...", "url": "https://...", "date": "2025-01-18", "author": "..."}
  ],
  "related_ids": [],
  "tags": []
}
```

## Inclusion rubric
Include when BOTH hold:
1. The item concerns use of public office or proximity to it for private gain, or abuse of office to punish oversight / reward allies / evade accountability.
2. At least one source is a legitimate journalistic outlet (see `docs/sources.md` tiers) or a primary document (court filing, IG report, GAO/OGE finding, disclosure form) reported on by one.

Exclude: policy disagreements, pure opinion, unsourced social-media claims, items from first-term (2017-2021) unless a new 2025+ development exists.

## Editorial rules
- Summaries are neutral and attributive ("The Times reported that..."). No adjectives of judgment.
- `status` reflects the latest known development, not the original report.
- Every dollar figure must have a `dollar_basis`. When no figure was reported, `dollar_amount_usd` is `null` (never 0).
- `date` is always `YYYY-MM-DD`; month-precision items use the 1st of the month with `date_precision: "month"`.
- One entry per discrete event; ongoing sagas get one parent entry plus dated child entries linked via `related_ids`.
