# Full acquisition data assessment

Assessment date: September 9, 2026. Run: `full-2026-09-08`.

## Decision

The full run produced a useful application checkpoint, but it did **not** finish. It paused after a run of source records with no separate detail representation. Those responses are now classified as source-unavailable outcomes, the same run is resumable, and no completed response will be fetched again. The app at `http://localhost:3005` now uses an immutable export of this checkpoint while acquisition continues against the separate working database.

The checkpoint is suitable for development and broad sample search. It is not yet a reviewed content-parity release: all 2,511 sample inventory records are present, but only 510 have parsed HTML enrichment and all 19,769 discovered photos still await detail-page enrichment. The app labels the snapshot as a continuing acquisition checkpoint.

## Checkpoint inventory

These counts come from the exported checkpoint generated at 12:02 UTC on September 9, 2026.

| Item | Count | Assessment |
| --- | ---: | --- |
| Missions | 9 | Complete against the API mission inventory |
| Samples | 2,511 | Complete union retained; searchable in the app |
| Samples with parsed HTML | 510 | 2,001 remain API-only at the checkpoint |
| Thin-section rows | 14,247 across 1,495 samples | All 2,511 related endpoints were checked |
| Display rows | 82 across 40 samples and 60 locations | All 2,511 related endpoints were checked |
| Discovered photo IDs | 19,769 | All currently come from captured sample galleries; independent search exhaustion remains open |
| Enriched photo records | 0 | All photo-detail requests were still pending at the checkpoint |
| Parsed page/search records | 618 | Includes 510 sample pages, 97 editorial pages, 10 sample searches, and the catalog |
| Publications | 448 | Derived from the 510 enriched sample pages; expected to grow |
| Bibliographic references | 286 | Independent bibliography search remained pending; expected to grow |
| Remote asset URLs | 22,169 | Links and placements only; media bodies were intentionally not downloaded |
| API/search sample differences | 192 | Preserved as legacy search differences; no samples were excluded |
| Pending requests | 22,240 | Primarily 19,769 photo details and 1,982 sample HTML pages |
| Unresolved validation errors | 0 | Queue incompleteness and review work still prevent acceptance |

The working/exported SQLite file was about 299 MB. The run retained 8,372 raw responses totaling about 50 MB at this checkpoint. The website snapshot is a separate 299 MB SQLite file with integrity and foreign-key checks passing and journal mode converted to `DELETE` so it opens reliably from a read-only container mount.

## Was all fetching necessary?

No. The first baseline deliberately checked endpoints even when summary flags suggested that they were redundant. That evidence now supports a faster refresh strategy:

- The 2,381 non-empty `sampledetails` responses were exactly identical, field for field, to the corresponding mission-inventory rows. Another 130 returned an empty JSON array. Future full runs now skip `sampledetails` when an API mission row already exists; pilot and HTML-only discoveries still request it.
- Thin-section endpoints returned data for 1,495 samples and were empty for 1,016. Every sample with rows had `has_thin_section=1`; there were no false negatives. Future full runs request this endpoint only for a flagged sample or a record not supplied by the mission inventory.
- Display endpoints returned 82 rows for 40 samples and were empty for 2,471. Every sample with rows had `has_display_sample=1`; there were no false negatives. Future full runs use the same audited gating rule.
- Sample HTML is still necessary. It supplies galleries, publication links, bibliography content, presentation labels, and source relationships not present in the API.
- Photo-detail HTML is still necessary for complete photo metadata and original image/TIFF destinations. Gallery discovery alone produces identifiers, relationships, and many previews, but it does not supply the complete photo record.
- Thin-section HTML pages may duplicate the normalized API rows. Keep them in this baseline for parity evidence, then compare their unique fields and presentation semantics before deciding whether future refreshes can omit them.

The verified changes remove roughly 6,000 API requests from a new full baseline. They do not remove already completed requests from this run; resume reuses their cached results.

## Speed and reliability changes

Resume remains sequential, but the delay between request starts is now overridable. This run resumes at 0.25 seconds instead of 1 second, with the existing retry, `Retry-After`, content-type, asset refusal, and repeated-error protections intact. The effective delay is written to `progress.json`. At the checkpoint denominator, request pacing falls from a theoretical minimum of about 6.2 hours to about 1.6 hours; server response time, large HTML parsing, retries, and newly discovered pages add to that estimate.

High-value bounded inventories and editorial routes now run before the large detail fan-out. Broad mission photo searches timed out after three 90-second attempts for Apollo 11. They have been superseded by 40 mission/photo-type and unfiltered/photo-type partitions using the four types exposed by the form: ortho, stereo, thin section, and processing. This should reduce server work per response and provides explicit partition-level coverage evidence.

That partitioning introduces one question that must remain open: a public photo with no type and no sample-gallery relationship would not appear in a typed search. The final audit must compare the union of typed searches, sample galleries, and photo details with any available original inventory. Do not call the photo catalog exhaustive until that boundary is resolved.

Editorial crawling was also reprioritized. This made 59 informational routes available in the app checkpoint rather than waiting behind tens of thousands of detail pages. Static image-directory links are now ignored as crawl targets; one discovered directory returned HTTP 403 and is retained as a source-unavailable observation rather than mistaken for a content page.

## Source limitations observed

- 130 inventoried samples returned an empty array from the separate sample-detail endpoint. Their mission-inventory records remain intact.
- 19 matching sample HTML routes returned the normal site shell without a sample record. They overlap the early group of API-detail absences and remain searchable through their mission records.
- The `<1 mm` and `>10 mm` soil-subtype API routes returned HTTP 404. Mission, unfiltered sample search, and other inventory paths still retained the samples. These failures are not successful empty partitions.
- Twenty source numeric values fall outside expected ranges and are preserved with provenance.
- Eight summary flags disagree with empty related results. These are false positives, not missing related rows.
- One acquired page uses dynamic content and still needs a rendered-browser review.
- Media and document bodies are remote dependencies. Their URLs and placements are captured, but link health and rendering must be checked separately.

Some source-unavailable conditions appear as both entity-level and request-level validation findings, so the report-row count is not a distinct-record count.

## Future investigations required

1. Finish the resumable queue and regenerate validation, reports, exports, and the application snapshot. A final snapshot is promoted automatically only when acquisition reaches `acquisition_finished_needs_review` with zero unresolved validation errors.
2. Prove photo inventory exhaustion. Review all 40 typed partitions for recognized terminal/empty results, repeated pages, caps, and unique IDs. Investigate untyped or unassociated photos through rendered behavior, original code/database access, or another authoritative inventory.
3. Compare sample HTML availability with the 130 API-detail absences and the 192 API/search membership differences. Determine whether the missing detail routes are intentional catalog boundaries, stale identifiers, or another legacy bug.
4. Complete the independent bibliography search and popup associations. Reconcile bibliography entries from the index against citations embedded in sample pages.
5. Compare thin-section HTML with API rows and decide whether it contains unique labels, notes, availability semantics, or navigation that requires continued fetching.
6. Audit editorial route discovery, especially newsletter fragments, core-photo pages, embedded content, duplicate case variants, and any pages reachable only through client-side loading. Map every retained route into the React adapter or record an explicit external destination.
7. Generate the planned relationship audit and manual-review sample. Check orphan targets, duplicate evidence links, photo/sample association conflicts, publication/reference identity, and 30–50 stratified samples across all missions.
8. Recheck remote images, TIFFs, PDFs, and other documents from the app without bulk-downloading them. Confirm captions, placement, accessibility text, and download destinations.
9. Benchmark the final database and container after photo enrichment. The checkpoint API responded in 11–63 ms for representative sample, photo, reference, and editorial queries; final asset/relationship volume will be much larger.
10. Reconcile the final `content-parity.csv` with implemented routes and representative user journeys before changing the dataset label from “candidate/review required” to a reviewed release.

## Acceptance boundary

Acquisition is complete only when every queued target is parsed or has a documented terminal source outcome, all discovery partitions have exhaustion evidence, and validation reports no extraction errors. The data is ready for release only after relationship/content review confirms that the React app exposes the acquired fields, tables, captions, links, and navigation. The current checkpoint meets neither final gate, even though it is substantially more useful than the pilot for application development.
