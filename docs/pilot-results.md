# Public website reverse engineering: pilot results

Run: `pilot-2026-09-08`, September 8, 2026. This is a completed **pilot**, not a complete acquisition of the website.

The Python project uses `uv`, a committed lockfile, immutable JSON/HTML evidence, a resumable request queue, versioned SQLite migrations, and CSV exports. The schema models the current public view; it can change when original code or databases provide additional information.

## Acquired and verified

| Item | Pilot result |
| --- | ---: |
| API missions inventoried | 9 |
| Sample records retained | 2,511 |
| Sample HTML detail pages | 6 |
| Discovered photo identifiers | 252 |
| Photo HTML detail pages | 12 |
| Thin-section records for selected samples | 67 |
| Display specimen records for selected samples | 2 |
| Parsed HTML pages/search states/fragments | 76 |
| Remote asset URLs recorded | 1,285 |
| Completed metadata requests in the persisted queue | 124 |
| API versus mission-search membership differences | 192 |
| Unresolved acquisition/validation errors | 0 |

All nine mission API inventories and website mission searches were processed. Detailed enrichment was limited to `63586`, `64476`, `67915`, `21000`, `10006`, and `10070`. Informational pages were capped at 25; photo details at 12. The pilot also queried the independent bibliography and followed its associated-sample popups.

The 192 inventory discrepancies are retained as **legacy search bugs pending a separate original-source audit**, as directed. They do not cause sample records to be discarded or define visibility restrictions for the replacement.

Twenty sample numeric outliers are preserved as source values. The newsletter index's dynamic presentation remains flagged for review; its linked newsletter fragments are recorded for subsequent acquisition. These are distinct from acquisition errors.

## Validation performed

- 24 tests pass using `uv run --project python --locked --extra test pytest python/tests -q`.
- Tests cover source-derived fixtures, complete gallery/reference extraction, POST search-state separation, empty photo results, bibliography relationships, nulls and precision, identifiers, request budgets, refusal to download asset bodies, CSV null escaping, and migration preservation/checksums.
- All 124 cached responses were reparsed without network access. Raw response hashes were checked.
- SQLite integrity check returned `ok`; foreign-key validation found no violations.
- SQLite and per-table CSV exports, a schema dictionary, coverage reports and a hash manifest were generated.

## Artifacts

- Coverage report: `../../curation_lunar_data/runs/pilot-2026-09-08/reports/coverage.md`
- Content inventory: `../../curation_lunar_data/runs/pilot-2026-09-08/reports/content-parity.csv`
- Content gaps: `../../curation_lunar_data/runs/pilot-2026-09-08/reports/content-gaps.md`
- Search discrepancies: `../../curation_lunar_data/runs/pilot-2026-09-08/reports/source-differences.csv`
- SQLite export: `../../curation_lunar_data/runs/pilot-2026-09-08/exports/lunar.sqlite`
- Export manifest: `../../curation_lunar_data/runs/pilot-2026-09-08/exports/manifest.json`

Generated run data is local and ignored by Git; these relative links work while the run directory is present. The small source fixtures and the extraction code remain in `/python`.

## Remaining work

Run full mode to acquire all discovered sample/photo details and remaining linked page content. Check full-size search result exhaustion and the unfiltered bibliography/photo inventory, which were not exercised by this limited pilot. Review dynamically loaded content and the remaining route inventory, then map every required content section into the React presentation model. A finished request queue alone does not establish website parity.

See [Python commands and behavior](../python/README.md), [the project plan](lunar-data-extraction-plan.md), and [the future schema audit process](schema-evolution.md).
