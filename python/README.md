# Lunar public website acquisition

This `uv` project reverse engineers the content of NASA's current public Lunar Curation website. It combines the supported API with sample/photo HTML and informational pages, records remote asset URLs without downloading their bodies, and produces SQLite, CSVs and coverage reports.

The schema represents the current public view. It can evolve through numbered migrations when original source code or database exports become available. API/search membership differences are retained as legacy search bugs for that later audit; records are never removed to imitate an undocumented search exclusion.

## Setup

All commands below run from the repository root. Use `uv` for all Python operations; do not use global Python or `pip`.

```powershell
uv sync --project python --locked --extra test
uv run --project python --locked --extra test pytest python/tests -q
```

`uv.lock` fixes dependency versions. `.python-version` selects Python 3.12. No credentials are required for the public sources.

## Start with the pilot

```powershell
uv run --project python --locked lunar-ingest start --mode pilot --run pilot-example --max-requests 120
```

The pilot inventories all nine API missions and website mission searches, enriches six representative samples, requests their photo searches, and limits photo details and informational pages. It deliberately does **not** claim a complete website extraction. Defaults: six sample IDs (`63586 64476 67915 21000 10006 10070`), 12 photo details, 25 informational pages, one request at a time, at least one second between requests.

Customize the pilot with `--samples`, `--photo-limit`, and `--page-limit`. Run directories cannot be overwritten by `start`.

## Full acquisition

```powershell
uv run --project python --locked lunar-ingest start --mode full --run full-example --max-requests 500
uv run --project python --locked lunar-ingest resume ../curation_lunar_data/runs/full-example --max-requests 500
```

Full mode removes pilot entity/page limits. It enumerates missions, lookup/filter endpoints, website sample searches, mission-wide and unfiltered photo searches, and the independent bibliography search; follows discovered sample/photo details, bibliography association popups and linked lunar HTML pages; and preserves editorial text, tables, forms, references, galleries and asset placements.

The full baseline `full-2026-09-08` was launched on September 8, 2026. See [scan status and next steps](../docs/full-scan-and-next-steps.md) for its background logs, monitoring and review checklist. For a new long run on Windows, `powershell -NoProfile -File scripts/run-full-scan.ps1 -RunName <new-run>` runs full mode without a request cap, then validates and exports when acquisition stops. Add `-Resume` for an existing full run after its previous writer has exited. The supervisor records protective pauses as needing attention, not completion.

`--max-requests` is a per-invocation HTTP budget, including retries and redirects. Hitting it pauses a persisted queue. Use `--max-requests 0` for an unbounded invocation only when intending a long run. `Ctrl+C` preserves completed requests. Resume does not fetch successful cached responses again.

`resume` also accepts `--delay <seconds>` to override the run's saved delay for one invocation. The `full-2026-09-08` evidence supports a 0.25-second sequential delay: retries, `Retry-After`, denial stops, and request persistence still apply, and `progress.json` records the effective delay. The Windows supervisor resumes that exact queue, validates, and exports it:

```powershell
powershell -NoProfile -File scripts/run-full-scan.ps1 -RunName full-2026-09-08 -Resume -PrepareApp -Delay 0.25
```

`-PrepareApp` changes the application snapshot only after the acquisition queue finishes and validation has zero unresolved errors. It does not turn that candidate into a reviewed parity release. See [the full-run assessment](../docs/full-data-assessment.md) for the measured redundancy and remaining investigations.

The baseline intentionally requests related API endpoints even when summary flags are null/false. All records discovered through any source remain in the dataset. Unknown fields are retained and flagged; missing/error pages are not treated as empty successful results.

The crawler follows observed links and captures forms but only automatically submits the known, read-only sample/photo/bibliography search forms. It does not submit sample requests, send messages, or traverse entire external sites. Other forms and dynamically loaded content are captured for review. A public inventory that caps results or hides additional content can require a new adapter; inspect the reports before calling acquisition complete.

## Resume, inspect, rebuild, export

```powershell
uv run --project python --locked lunar-ingest status ../curation_lunar_data/runs/pilot-example
uv run --project python --locked lunar-ingest resume ../curation_lunar_data/runs/pilot-example --max-requests 120
uv run --project python --locked lunar-ingest resume ../curation_lunar_data/runs/pilot-example --retry-failed --max-requests 120
uv run --project python --locked lunar-ingest parse ../curation_lunar_data/runs/pilot-example
uv run --project python --locked lunar-ingest validate ../curation_lunar_data/runs/pilot-example
uv run --project python --locked lunar-ingest export ../curation_lunar_data/runs/pilot-example
```

`parse` rebuilds derived tables from saved responses without network access. It may discover new pending requests after parser changes; inspect and resume explicitly. It resets generated review/disposition rows, so keep human review decisions outside those generated tables for now.

`validate` exits nonzero for unresolved error findings. A successful command is not a declaration of content parity. Source anomalies and search differences remain reportable without discarding records. Exports are labeled candidates requiring content review.

## Outputs

```text
../curation_lunar_data/runs/<run>/
  run.json                       # scope, model version and configuration hash
  progress.json                  # last acquisition/reparse queue state
  lunar.sqlite                   # working dataset, request queue and provenance
  raw/                           # immutable JSON/HTML/text response bodies
  reports/
    coverage.md / coverage.json
    content-parity.csv
    content-gaps.md
    source-differences.csv
    field-coverage.csv
    validation-issues.csv
    asset-links.csv
  exports/
    lunar.sqlite                 # consistent SQLite backup
    csv/                         # one file per table
    data-dictionary.json
    manifest.json                # configuration, schema versions, hashes and limits
```

Use `--data-dir` at `start` to override the default sibling `../curation_lunar_data/runs` location. Do not run two writers against the same run directory. Run histories and bulk data live outside the source repository; the small test fixtures and their source manifest are committed project inputs.

CSV null is `\N`; a literal backslash is doubled. Check the null token before unescaping values. Import identifier columns as text. CSVs are literal source-data exports, not spreadsheet-formula-safe presentation files. Raw API tokens remain available when exact decimal spelling matters.

Imported HTML is **untrusted source content**, not ready-to-execute React markup. Sanitize and rewrite internal links through a presentation adapter. `pages`, `content_blocks`, `page_links` and `asset_occurrences` preserve context for that adapter; `samples`, related records and `photos` provide normalized searchable entities.

## Validation scope

Fixture tests cover actual NASA responses, all gallery/reference items beyond the UI's first page, complete photo-form controls, nulls/precision, thin-section codes, multi-specimen displays, external TIFF links, identifier normalization, schema drift, cache replay, request budgets and asset-body refusal.

Generated reports distinguish acquisition states and source differences. The content-parity inventory is a starting checklist, not a proof that all routes or dynamic states were discovered. Before the full React release, review navigation, result exhaustion, embedded content, publication/core table semantics, asset accessibility and representative user journeys against the live website.

For changes to the model, see [the schema evolution process](../docs/schema-evolution.md). Add a migration instead of editing an applied SQL file; checksums enforce that rule.
