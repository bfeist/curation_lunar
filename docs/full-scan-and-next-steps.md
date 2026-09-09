# Full acquisition and next steps

Run: `full-2026-09-08`. Started September 8, 2026 at 18:55 EDT (22:55 UTC).

**Status after assessment: a background resume is running; acquisition is not complete.** The initial invocation parsed 8,122 requests before three consecutive source records without separate detail representations triggered a protective pause. Cached responses were reparsed with corrected terminal-source handling, and the app now uses an immutable full-run checkpoint. See the [data assessment](full-data-assessment.md) for counts, request-reduction evidence, and open investigations.

The resumed scan has no invocation request cap and no pilot sample/photo/page caps. It remains sequential, now with 0.25 seconds between request starts based on the completed baseline audit, and preserves responses and queue state. Server latency, large HTML parsing, retries, and further discovery add to the request-pacing estimate. Keep the computer awake and connected until the process finishes.

The scope is all metadata and page content discoverable by the current extractor: mission and alternate API inventories; every discovered sample's details, thin sections, displays and HTML; sample and independent photo searches; photo details; independent bibliography and sample associations; and linked informational HTML. Images, PDFs, TIFFs and other media remain remote URLs with their placement and captions, per the [agreed scope](lunar-data-extraction-plan.md). A finished crawl still needs inventory-exhaustion and content review before it can be described as all current-site content.

### Early findings requiring follow-up

NASA returned HTTP 404 for two alternate soil-subtype inventories:

- `/rest/lunarapi/samples/samplesbysubtype/Soil?subtype=%3C1%20mm` (`<1 mm`).
- `/rest/lunarapi/samples/samplesbysubtype/Soil?subtype=%3E10%20mm` (`>10 mm`).

The saved responses contain the server's file-or-directory-not-found page. They are classified as source-unavailable partitions rather than extraction errors and did not remove any samples from the mission inventory. The 130 empty API details, 19 empty HTML detail shells, broad photo-search timeout, request redundancy, and other findings are covered in the [full assessment](full-data-assessment.md).

## Running process and artifacts

The hidden PowerShell supervisor runs [scripts/run-full-scan.ps1](../scripts/run-full-scan.ps1), which resumes acquisition, validates it, and exports a candidate dataset. With `-PrepareApp`, it promotes and restarts the local container only when the queue finishes and validation has zero unresolved errors. A protective pause remains `needs_attention`; server denial/backoff protections are not overridden.

All commands below run from the repository root:

```powershell
# Live request log and errors; safe while acquisition is active.
Get-Content data/scan-logs/full-2026-09-08-resume.stdout.log -Tail 30 -Wait
Get-Content data/scan-logs/full-2026-09-08-resume.stderr.log -Tail 20
Get-Content data/scan-logs/full-2026-09-08.status.json

# Current persisted queue counts.
uv run --project python --locked lunar-ingest status data/runs/full-2026-09-08
```

The supervisor status identifies its stage (`acquiring`, `validating`, `exporting`, `acquisition_finished_needs_review`, `needs_attention`, or `failed`). Its timestamps mark stage transitions, not a heartbeat. The request log and queue are the live progress sources; `progress.json` and coverage reports update when the acquisition invocation ends. A terminated process can leave stale status, so verify process activity and log movement if progress appears stuck.

| Location | Purpose |
| --- | --- |
| `data/runs/full-2026-09-08/run.json` | Scope, creation timestamp and parser/configuration fingerprints |
| `data/runs/full-2026-09-08/lunar.sqlite` | Working database and durable request queue |
| `data/runs/full-2026-09-08/raw/` | Immutable source JSON/HTML/text evidence |
| `data/scan-logs/full-2026-09-08.*` | Supervisor state, standard output and error logs |
| `data/runs/full-2026-09-08/reports/` | Coverage, validation, source differences and content inventory after acquisition stops |
| `data/runs/full-2026-09-08/exports/` | Candidate SQLite, per-table CSVs, dictionary and hash manifest after validation/export |

Run data and logs are ignored by Git. Preserve a backup of the completed run, including raw evidence, before treating it as the reconstruction baseline.

If interrupted, first confirm the old supervisor and ingestion process have exited. Then resume with automatic validation/export:

```powershell
powershell -NoProfile -File scripts/run-full-scan.ps1 -RunName full-2026-09-08 -Resume -PrepareApp -Delay 0.25
```

Do not run a second acquisition, reparse, validation or export writer against the active run. The supervisor retries failed requests once so corrected parsers can consume cached successful responses and known terminal HTTP outcomes can be reclassified. Repeat server denial or a requested pause still requires attention, not a retry loop. Keep human review decisions outside generated tables because reparse resets those tables.

## What to do next, in order

1. **Finish acquisition and resolve extraction failures.** Read `progress.json`, `coverage.md`, `validation-issues.csv` and `content-gaps.md` when the supervisor stops. Account for every pending, fetched and failed request. Distinguish a source-unavailable record from a parser defect or network failure; retain the source evidence and record the disposition. Confirm every discovered sample has the expected API/HTML enrichment and every discovered photo has a detail outcome. The CLI can exit successfully after a protective pause, so use the queue and supervisor status as the completion evidence.

2. **Prove discovery coverage.** Inspect the unfiltered and mission-partitioned photo results, sample searches, alternate API partitions, and independent bibliography for caps, missing partitions and pagination. Compare ID sets, not just totals. Record the terminal-page or all-rows-in-response evidence for each inventory. Review the newsletter's dynamically loaded fragments, embedded content, lunar navigation, cores, special collections, catalogs, publications and guidance routes. Extend adapters for required content absent from the acquired model. A zero pending count alone does not satisfy this step.

3. **Audit relationships and review representative content.** Produce the planned `relationship-audit.csv` and `review-samples.csv`; the current report generator does not yet emit these two reports. Check missing targets, duplicate or conflicting specific specimens, photo/sample association disagreements and references. Review approximately 30–50 samples across all nine missions and major content variations, explicitly including `63586`, `64476`, `67915`, `21000`, `10006`, and `10070`; also review each observed photo type and multi-sample captions. Compare text, units, labels, complete galleries, citations, tables and asset placement with saved evidence and selected live pages.

4. **Freeze a reviewed candidate and document full results.** Replace this preliminary checkpoint with final counts, acquisition dates, errors/dispositions, gaps and review findings. Confirm SQLite integrity and foreign keys, raw-response hashes, and CSV/SQLite entity and relationship parity. Regenerate the export manifest after fixes. Retain API/search membership differences as legacy search bugs for the separate original-source audit; the pilot found 192 differences, but the full-run total must be measured. Keep source numeric anomalies with evidence. Do not label the dataset complete while required content remains missing.

5. **Reconcile the existing React data and route contracts.** Map each row of `content-parity.csv` to an implemented destination route and renderable model. The read-only SQLite service and presentation adapter already exist; extend them for newly acquired structures, benchmark final volume, and keep the browser contract independent of raw NASA field casing and audit tables.

6. **Verify the replacement website with the completed candidate.** Repeat mission browsing, sample/photo search and details, publications, informational routes, cross-navigation, complete galleries, remote assets, keyboard access, and responsive layouts. Use the [hosting setup](hosting.md) and review publication separately. Recheck changed source content near launch; mark parity only after the required user journeys and content inventory pass.

## Verification before launch of this scan

The acquisition suite now passes **26 tests**; the app passes **15 tests**, plus TypeScript and lint checks. The full-run checkpoint passed SQLite integrity, foreign-key validation, snapshot preparation, container health, and representative API checks. Its reports and export are generated, but final acquisition and content-parity review remain pending.
