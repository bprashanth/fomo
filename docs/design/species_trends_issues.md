# Species Trends — Known Data Issues

Issues found in `biodiversity_db.json` and `biodiversity_db_plots.json` that affect
the trend chart and map visualizations.  Both files share the same underlying GBIF ZIP
+ Zenodo source, so every issue affects both.

---

## Issue 1 — Out-of-range year values distort the chart x-axis

### Symptom
The bubble chart x-axis (year) spans 0 → ~2025 instead of 2021 → 2025, with
a dense cluster of bubbles around 2021–2025 and a handful of outliers at the left
and right edges.  The `year=null` entries are rendered by Chart.js linear scale
as `0`, dragging the axis origin all the way to 0 and making the 2021–2025 cluster
appear squashed to the far right.

### Counts (out of 25,500 total entries in `biodiversity_db.json`)

| Category | Count | % of total |
|----------|-------|------------|
| `year = null` | 149 | 0.6% |
| `year < 2021` (Zenodo data pre-dating GBIF filter window) | 3,197 | 12.5% |
| `year > 2025` (year=2026 leak from GBIF) | 113 | 0.4% |
| **Total out-of-range** | **3,459** | **13.6%** |

### Sources
- `year=null`: Zenodo sources `raman2024b` (112), `kempeg2025` (36), `founda2022` (1).
  These papers do not include observation dates at the entry level.
- `year < 2021` (2011–2018): Entirely from Zenodo data — the GBIF download was already
  filtered to 2021–2025, but `biodiversity_zenodo.json` has no year filter applied.
  Pre-2021 years present: 2011 (293), 2012 (151), 2016 (761), 2017 (1,359), 2018 (625).
- `year = 2026`: 113 GBIF entries with observations dated in 2026 (likely data-entry
  errors at the source — the download predicate was `year ≤ 2025` but GBIF occasionally
  returns records outside the requested window).

### Fix
Frontend display filter in `SurveyResultPanel.vue`, applied before building any chart:
```js
const validEntry = e => e.year != null && e.year >= 2016 && e.year <= 2025;
```
Rationale for `2016` lower bound: the Zenodo data (which pre-dates the GBIF 2021–2025
window) contains valid observations from 2016 onward.  Showing these gives more context
for the restoration arc.  Data before 2016 is not present in the current files.

The `year > 2025` entries (year=2026) are GBIF records whose source dataset's ingestion
date leaked into the `year` field at GBIF — a known GBIF data quality issue.  Drop them.

Raw JSON files are not modified; the filter is display-only.

---

## Issue 2 — Comma-separated species names

### Symptom
Some `species` field values contain multiple species names joined by commas, e.g.
`"Elephant,Gaur"` or `"Nilgiri Langur,Malabar Giant Squirrel"`.  These appear as a
single species row in the trend chart, duplicating real single-species rows and making
the Y-axis misleadingly sparse.

### Two distinct sub-issues

**2a — True multi-species entries (real flaw)**
169 entries where the species field genuinely encodes multiple animals in one record,
almost entirely from the `founda2022` Zenodo paper (168 entries, 1 from `GBIF`).
These represent camera-trap detections where multiple animals were recorded in the same
observation event and the species field was never split.

| Sample value | Count |
|-------------|-------|
| `Nilgiri Langur,Malabar Giant Squirrel` | 22 |
| `Bonnet Macaque,Nilgiri Langur` | 8 |
| `Lion-tailed Macaque,Malabar Giant Squirrel` | 8 |
| `Elephant,Gaur` | 4 |
| (others) | ~127 |

**2b — Scientific author-year notation (not a real multi-species entry)**
261 entries where the comma separates the genus from the taxonomic author and year,
e.g. `"Ardea Linnaeus, 1758"` or `"Tachyspiza Kaup, 1844"`.  These are valid
single-taxon records but the species name includes the authority citation.  Chart.js
will display the full string as the species label, which is ugly but not factually wrong.

| Sample value | Count |
|-------------|-------|
| `Ardea Linnaeus, 1758` | 80 |
| `Tachyspiza Kaup, 1844` | 72 |
| `Lophospiza Kaup, 1844` | 41 |
| `Pachyglossa Hodgson, 1843` | 18 |

### Fix — 2a (true multi-species)

Fixed in the **transform scripts** (`download_biodiversity.py` and
`aggregate_by_plots.py`), not at render time — the data should be correct at source.

A `split_multi_species()` helper (shared logic in both scripts) expands any entry
where `species` contains a comma that is not an author-year suffix into N records,
each with the same `count` as the original.  Example:

```
{ species: "Elephant,Gaur", count: 10 }
  →
{ species: "Elephant", count: 10 }
{ species: "Gaur",     count: 10 }
```

Each constituent species gets the full count because the original observation means
both animals were detected that many times — the count is not divided.

After the fix, re-run both scripts to regenerate the JSON files (no new GBIF download
needed — the cached ZIP is reused).

### Fix — 2b (scientific names)

**No fix scheduled.**  These are valid single-taxon observations; the comma is part
of the taxonomic authority notation, not a species separator.  The `is_author_year()`
guard in the multi-species split helper already avoids incorrectly splitting them.
Documented here as a known cosmetic flaw (ugly species labels in the dropdown).

---

## Affected files

| File | Issue 1 | Issue 2 |
|------|---------|---------|
| `data/biodiversity_db.json` | yes | yes |
| `data/biodiversity_db_plots.json` | yes (same source) | yes (same source) |
| `web/app/public/data/biodiversity_db.json` | yes | yes |

---

## Priority

Both issues should be fixed client-side in `SurveyResultPanel.vue` before the timelapse
feature is implemented, because:
- Issue 1 makes the x-axis unreadable for any cumulative timelapse view
- Issue 2 causes ghost species rows that inflate the Y-axis height and make per-species
  trend lines incorrect
