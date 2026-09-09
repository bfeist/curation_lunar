# Full acquisition and next steps

Run: `full-2026-09-08`. Started September 8, 2026 at 18:55 EDT (22:55 UTC).

**Status at this handoff: running in the background; acquisition is not complete.** This is a new full-mode baseline, separate from `pilot-2026-09-08`. The first live checkpoint processed all nine mission inventories and retained 2,511 samples, with more than 10,000 requests already queued and no failed requests at that checkpoint. These are preliminary counts: photo searches, alternate inventories and linked pages can expand the queue substantially.

The scan has no invocation request cap and no pilot sample/photo/page caps. It uses one request at a time, with at least one second between request starts, and preserves responses and queue state for resume. The initial queue alone implies roughly three hours of request pacing; parsing, server latency, photos, bibliography associations and further discovery add time. Keep the computer awake and connected until the process finishes.

The scope is all metadata and page content discoverable by the current extractor: mission and alternate API inventories; every discovered sample's details, thin sections, displays and HTML; sample and independent photo searches; photo details; independent bibliography and sample associations; and linked informational HTML. Images, PDFs, TIFFs and other media remain remote URLs with their placement and captions, per the [agreed scope](lunar-data-extraction-plan.md). A finished crawl still needs inventory-exhaustion and content review before it can be described as all current-site content.

### Early findings requiring follow-up

A later startup checkpoint reached 123 parsed requests, 10,170 pending requests and two failures. Both failures were NASA HTTP 404 responses for alternate soil-subtype inventories:

- `/rest/lunarapi/samples/samplesbysubtype/Soil?subtype=%3C1%20mm` (`<1 mm`).
- `/rest/lunarapi/samples/samplesbysubtype/Soil?subtype=%3E10%20mm` (`>10 mm`).

The saved responses contain the server's file-or-directory-not-found page. The scan continued to other partitions; these failures did not remove any samples from the mission inventory. Determine whether another supported inventory covers the affected records and retain the unavailable-partition evidence. Their completeness is unresolved, and they must not be relabeled as successful empty searches. Unless addressed after acquisition, these failures will cause the supervisor to finish as `needs_attention` and validation to report errors, while still exporting a review candidate.

## Running process and artifacts

The hidden PowerShell supervisor started with PID `71988`; that PID is only an initial diagnostic, since PIDs can be reused. It runs [scripts/run-full-scan.ps1](../scripts/run-full-scan.ps1), which acquires data, validates it, and exports a candidate dataset. It preserves a protective pause or acquisition failure as `needs_attention` instead of calling the scan complete. It does not automatically retry failed requests or override server denial/backoff stops.

All commands below run from the repository root:

```powershell
# Live request log and errors; safe while acquisition is active.
Get-Content data/scan-logs/full-2026-09-08.stdout.log -Tail 20
Get-Content data/scan-logs/full-2026-09-08.stderr.log -Tail 20
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
powershell -NoProfile -File scripts/run-full-scan.ps1 -RunName full-2026-09-08 -Resume
```

Do not run a second acquisition, reparse, validation or export writer against the active run. Inspect failed requests before using `resume --retry-failed`; repeat server denial or a requested pause requires attention, not a retry loop. After a parser fix, reparse cached responses offline, then resume any newly discovered requests. Keep human review decisions outside generated tables because reparse resets those tables.

## What to do next, in order

1. **Finish acquisition and resolve extraction failures.** Read `progress.json`, `coverage.md`, `validation-issues.csv` and `content-gaps.md` when the supervisor stops. Account for every pending, fetched and failed request. Distinguish a source-unavailable record from a parser defect or network failure; retain the source evidence and record the disposition. Confirm every discovered sample has the expected API/HTML enrichment and every discovered photo has a detail outcome. The CLI can exit successfully after a protective pause, so use the queue and supervisor status as the completion evidence.

2. **Prove discovery coverage.** Inspect the unfiltered and mission-partitioned photo results, sample searches, alternate API partitions, and independent bibliography for caps, missing partitions and pagination. Compare ID sets, not just totals. Record the terminal-page or all-rows-in-response evidence for each inventory. Review the newsletter's dynamically loaded fragments, embedded content, lunar navigation, cores, special collections, catalogs, publications and guidance routes. Extend adapters for required content absent from the acquired model. A zero pending count alone does not satisfy this step.

3. **Audit relationships and review representative content.** Produce the planned `relationship-audit.csv` and `review-samples.csv`; the current report generator does not yet emit these two reports. Check missing targets, duplicate or conflicting specific specimens, photo/sample association disagreements and references. Review approximately 30–50 samples across all nine missions and major content variations, explicitly including `63586`, `64476`, `67915`, `21000`, `10006`, and `10070`; also review each observed photo type and multi-sample captions. Compare text, units, labels, complete galleries, citations, tables and asset placement with saved evidence and selected live pages.

4. **Freeze a reviewed candidate and document full results.** Replace this preliminary checkpoint with final counts, acquisition dates, errors/dispositions, gaps and review findings. Confirm SQLite integrity and foreign keys, raw-response hashes, and CSV/SQLite entity and relationship parity. Regenerate the export manifest after fixes. Retain API/search membership differences as legacy search bugs for the separate original-source audit; the pilot found 192 differences, but the full-run total must be measured. Keep source numeric anomalies with evidence. Do not label the dataset complete while required content remains missing.

5. **Define the React data and route contracts.** Map each row of `content-parity.csv` to a destination route and renderable model. Measure final entity counts and export sizes before choosing build-generated JSON/search indexes or a small read-only SQLite service. Specify sample search/filter fields, sample/photo relationships, thin-section availability, display locations, bibliography, publication links and editorial tables. Sanitize imported HTML and rewrite internal links through the presentation adapter. Keep the frontend contract independent of raw NASA field casing and audit tables.

6. **Build and verify the replacement website.** Create the root React project with source in `/src`, then implement mission browsing, sample search/detail, photo search/detail, publications and informational routes. Search the retained record union. Verify sample-to-photo and photo-to-sample navigation, complete galleries, remote images/documents, request/return guidance, keyboard access and responsive layouts. Use the [hosting setup](hosting.md) and review publication separately. Recheck changed source content near launch; mark parity only after the required user journeys and content inventory pass.

## Verification before launch of this scan

The existing acquisition suite passed: **24 tests**, using `uv run --project python --locked --extra test pytest python/tests -q`. Live startup verified successful NASA responses, all nine mission inventories, a persisted full-mode run configuration, continued queue progress and an empty error log at the initial checkpoint. Full-run validation, exports and content parity remain pending until the scan and review finish.
