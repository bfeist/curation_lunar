# NASA Lunar Curation: reverse engineering of the current public website

Status: Python acquisition implementation and live pilot completed; the full harvest and website parity review remain outstanding. See `/python/README.md` for executable commands and generated run reports for actual coverage. The React application has not been built.

Inspected: September 8, 2026.

## 1. Objective and decisions

Build a new React version of the Lunar Curation website that gives users access to the content available on the current site. The current website defines the content requirements: its pages, sample records, photos, descriptions, references, publications, tables, instructions, and the navigation/search paths through which users reach them. The design and implementation can change while preserving that information and access.

Content acquisition is the first implementation phase of that website project. Obtain each required item from whichever source supplies it faithfully: the documented API, rendered website content, public HTML responses, another NASA-provided source, or the original database when available. An API's fields and coverage do not define or limit the replacement website's scope. Use Python under `/python` for acquisition, SQLite as the working dataset, and related CSV exports for inspection.

All Python development and execution uses `uv`: project environment, dependency resolution, committed `uv.lock`, CLI runs, and tests. See the Python README for the current commands.

### Agreed interpretation of legacy behavior and history

This is a **reverse engineering of the currently viewable public website**. The user describes an Apollo-era data structure and decades of evolving curation processes. That history is a reason to preserve original evidence and make our schema revisable, not to assume we can reconstruct those historical processes from today's public pages.

Treat discrepancies between API inventory and legacy search results as bugs in the legacy search for this project. Retain the union of records and make valid acquired records searchable in the replacement; do not reproduce undocumented exclusion rules. Preserve current search output as evidence. If original code becomes available, audit those discrepancies separately without blocking this reconstruction.

The local schema models the public view and is not asserted to be NASA's original or final authoritative schema. Use versioned migrations, immutable raw responses, field provenance and explicit source mappings. When original code/data arrives, perform the separate audit and follow the schema evolution process in [schema-evolution.md](schema-evolution.md).

Keep image, PDF, TIFF, and other asset URLs pointing to their existing hosts. Do not download asset bodies. Save API JSON and source HTML as extraction evidence; those are the data inputs, not mirrored media assets.

The first milestone is a content inventory and reproducible dataset that can supply every inventoried page and content section of the replacement website. Measure its readiness against the current site's user-visible content. The React project will live at the repository root with application code in `/src`.

“Complete” means that users of the replacement website can find and view the current site's content, measured against a dated baseline and checked again before launch. Successfully importing all API rows or parsing all discovered URLs is supporting evidence, not the completion criterion. We do not need to reconstruct NASA's private database to meet this goal.

For assets, parity means preserving their presentation and access: show an image where the current page shows an image, preserve its caption and context, and provide the corresponding document/download link where the current site provides one. Remote hosting satisfies this requirement; a URL stored in SQLite but never exposed in the replacement does not. PDF contents need not become database fields when the current experience is to open that PDF.

## 2. Findings from live reconnaissance

### API surface

The [API documentation](https://curator.jsc.nasa.gov/lunar/api/) describes this base URL:

```text
https://curator.jsc.nasa.gov/rest/lunarapi/samples
```

| Endpoint suffix | Purpose | Inspection status |
| --- | --- | --- |
| `/listmissions` | Enumerate missions | Called |
| `/listsampleclassification` | Classification and subtype vocabulary | Documented; pilot must inspect response |
| `/liststationsbymission/{mission}` | Station vocabulary | Documented; pilot must inspect response |
| `/listlandmarksbymission/{mission}` | Landmark vocabulary | Documented; pilot must inspect response |
| `/samplesbymission/{mission}` | Discover samples and retrieve core fields | Called for Apollo 11 and Luna 16 |
| `/samplesbyclassification/{sampleType}` | Alternate sample discovery | Documented; pilot must inspect response |
| `/samplesbysubtype/{sampleType}?subtype={sampleSubtype}` | Alternate filtered discovery | Documented; pilot must inspect response |
| `/samplesbystation/{mission}/{station}` | Alternate filtered discovery | Documented; pilot must inspect response |
| `/samplesbylandmark/{mission}/{landmark}` | Alternate filtered discovery | Documented; pilot must inspect response |
| `/sampledetails/{genericID}` | Individual sample fields | Called for 63586 |
| `/samplethinsections/{genericID}` | Specific thin-section records | Called for 64476 |
| `/sampledisplays/{genericID}` | Display specimens and locations | Called for 67915 |

Inspected responses are JSON arrays of objects with uppercase keys, including the individual-sample endpoint. Do not assume it returns a single object. URL-encode path components and query values.

The [mission endpoint](https://curator.jsc.nasa.gov/rest/lunarapi/samples/listmissions) returned Apollo 11, 12, 14, 15, 16, 17 and Luna 16, 20, 24. Include all nine by default, discover the list dynamically, and keep mission as a filter in the future application.

No photo, bibliography, or publication-link endpoint appears in the inspected API documentation. The initial architecture therefore requires HTML enrichment; an API-only import is insufficient for recreating the public catalog.

### Website routes and behavior

The [sample and photo catalog](https://curator.jsc.nasa.gov/lunar/samplecatalog/index.cfm) exposes sample search, photo search, mission browsing, and a publication index.

| Surface | Observed route / behavior | Data to extract |
| --- | --- | --- |
| Mission/sample results | POST `/lunar/samplecatalog/sample_results_list.cfm` | Sample IDs, summary fields, display-specific labels, source membership |
| Sample detail | `/lunar/samplecatalog/sampleinfo.cfm?sample=63586` | Core labels, publications, references where present, photo associations |
| Thin-section table | `/lunar/samplecatalog/thinsections.cfm?sample=64476` | Generic, specific, weight, description, availability label |
| Photo results | POST `/lunar/samplecatalog/photo_results_list.cfm` | Photo identifiers, associations, classification and descriptive metadata |
| Photo detail | `/lunar/samplecatalog/photoinfo.cfm?photo=S72-42069` | Generic, related specifics, type/subtype, film type, description, angle, orientation, asset links |
| Other lunar pages | Follow relevant links from the lunar home and catalog | Compendium/catalog indexes, cores, specially curated samples, references and display context |

Verified mission-search form values: `tabType=mission`, `sortOptions=sample`, `missionOptions=Apollo 11`. A sample search worked with `tabType=advsamplesearch`, `sortOptions=sort`, `generic=63586`.

A minimal photo POST produced an application-error page. Replaying the full form's successful controls, including hidden inputs and empty selectors, in a cookie-aware session worked. Build the request from the current form rather than hardcoding only the visible filters. Preserve repeated form names as a list of pairs. The verified photo query used `advgeneric=63586`, `tabType=advphotosearch`, and `sortOptions=photonumber`, plus the form defaults.

On inspected sample pages, references and gallery records are present in the initial HTML and paginated in the browser by jPList. Parse all underlying items, not just the default five visible items. A literal “No results found” placeholder exists alongside populated lists; it is not evidence of an empty result. Pagination on other routes and larger result sets still needs verification.

### Concrete reconciliation cases

These are observations from a small inspection, not final collection totals:

1. **API versus mission-search membership:** the [Apollo 11 API response](https://curator.jsc.nasa.gov/rest/lunarapi/samples/samplesbymission/Apollo%2011) contained 80 distinct generic IDs. The website mission-search response contained 67 distinct sample links, all present in that API response. The 13 API-only IDs were `10006`, `10007`, `10012`, `10035`, `10037`, `10038`, `10077`, `10079`, `10100`, `10101`, `10102`, `10103`, `10104`. A direct [10006 detail page](https://curator.jsc.nasa.gov/lunar/samplecatalog/sampleinfo.cfm?sample=10006) exists despite its omission from that mission result. The cause remains unverified. Retain the union; do not treat unequal source totals alone as a failed extraction.
2. **Precision:** the Luna 16 API lists 21000 at `0.593` grams, while its [detail page](https://curator.jsc.nasa.gov/lunar/samplecatalog/sampleinfo.cfm?sample=21000) displays `0.59 g`. Preserve API precision and compare at the HTML field's displayed precision.
3. **Source outlier:** Apollo 11 sample 10070 has `PRISTINITY=112.5`, and the mission page displays `112.50`. Preserve and flag this value; do not clamp percentages to 100 or reject the record.
4. **Missing internal IDs:** `SAMPLEID` can be null, including for 10001 and Luna samples. Use the catalog's generic identifier as the working sample key, subject to a global uniqueness check.
5. **Thin sections:** the [64476 API](https://curator.jsc.nasa.gov/rest/lunarapi/samples/samplethinsections/64476) returned five specific records. The [HTML table](https://curator.jsc.nasa.gov/lunar/samplecatalog/thinsections.cfm?sample=64476) matched them and labeled code `1` as available and `0` as on loan. Treat that as a verified mapping for the observed codes; retain unknown codes.
6. **Display relationships:** the [67915 display API](https://curator.jsc.nasa.gov/rest/lunarapi/samples/sampledisplays/67915) returned two specimens, specifics 276 and 302, at the same location ID 23. Location IDs are not unique display-specimen IDs. Generic/specific values arrived as JSON numbers here, unlike their string representation in thin-section data.
7. **HTML enrichment:** [63586](https://curator.jsc.nasa.gov/lunar/samplecatalog/sampleinfo.cfm?sample=63586) has three publication links and seven photo links. Its compendium link points to `63548.pdf`; never manufacture document URLs from a generic number. [67915](https://curator.jsc.nasa.gov/lunar/samplecatalog/sampleinfo.cfm?sample=67915) also exposes bibliographic references and a much larger gallery.
8. **Photo associations need provenance:** the [S72-42069 detail page](https://curator.jsc.nasa.gov/lunar/samplecatalog/photoinfo.cfm?photo=S72-42069) lists generic 63586 and related specific `0`, while its caption mentions multiple samples. Other photos on 63586's page have captions naming different sample groups. Store the website's associations and caption text independently; do not silently “correct” either from the other.
9. **Assets can be external:** that photo's JPEG is on the curation host, while its TIFF link is on the public PDS-associated S3 host. Store the actual linked host/path. Do not restrict asset metadata to curation-host URLs or fetch the TIFF.

The site's [robots.txt](https://curator.jsc.nasa.gov/robots.txt) currently declares `User-Agent: *` and `Disallow: /`, while the API is explicitly documented for querying. Record this as source metadata. The user has requested the public-site reconstruction and extraction; the implementation uses identifiable, sequential, rate-limited metadata requests, honors server backoff/denials, and downloads no image/PDF assets.

## 3. Scope and completeness boundaries

### Required content for the replacement website

- Every generic sample discoverable through the public API and catalog search/index surfaces, including Luna records.
- All public core fields, thin sections, display records and their location metadata.
- Sample/photo relationships and photo detail metadata, including remote image variants.
- Sample bibliographies, catalog/compendium publication links, and displayed publication metadata.
- Public filter vocabularies, including values present in data but missing from UI choices.
- All lunar informational pages, page sections, tables, captions, navigation labels, contacts, news/archive content, and request/return guidance and forms exposed by the current site.
- The placement and role of images, document links, embedded content and outbound destinations so the new pages can present them in context.
- Raw JSON/HTML, request provenance, extraction state, field observations, and coverage reports.

### Website content inventory: the primary checklist

Inventory the lunar website from its navigation, sitemap, indexes, search forms, detail links, archives, and linked content sections. Include catalog and compendium indexes, core photograph and summary pages, specially curated samples, references, display pages, facilities/tours, request/return information, and other informational pages. These pages are required content, not optional enrichment. Scope remains the lunar site rooted at the supplied URL; preserve links to other curation collections and external destinations without implicitly rebuilding those entire sites.

Create a content-parity matrix with one entry per static page/section and per dynamic page template plus its record inventory. Record: current URL or search state, title/section, content and relationships shown, asset roles, navigation entry points, chosen acquisition source, local entity/content-block mapping, future route/component, acquisition status, and verification evidence. Include content behind tabs, pagination, galleries, dialogs and forms. Inventory completion itself must be reviewed against the current navigation and user journeys so undiscovered pages cannot silently disappear from the denominator.

Extract structured tables and relationships into schema extensions; preserve editorial content as ordered blocks with headings, text, lists, tables, links and image captions. Raw HTML is evidence, not a substitute for a renderable content model. Keep section-level progress reports, but completing the sample database alone does not complete the content acquisition phase.

### Explicit limits

- No media mirroring, OCR, or PDF contents extraction in this phase. Preserve user access to these assets and their surrounding context through the original URLs.
- No inference that thin sections, display specifics, or specifics named in captions constitute the full specimen subdivision database.
- No private database recovery or authentication bypass. Preserve public request/return instructions, forms and existing submission destinations; this phase does not implement internal allocation systems or submit requests.
- No React implementation until the data milestone is assessed.

## 4. Storage and proposed schema

Use SQLite for keys, relationships, transactions, and validation queries. Export one UTF-8 CSV per entity/join table rather than flattening photos, references and thin sections into repeated sample rows. Keep untouched response files alongside SQLite so parsing can be improved without refetching.

### Core sample fields

The following API keys were observed in mission responses and/or the [63586 detail response](https://curator.jsc.nasa.gov/rest/lunarapi/samples/sampledetails/63586). Preserve the complete original record even after mapping these fields.

| API key | Proposed `samples` column | Type / rule |
| --- | --- | --- |
| `GENERIC` | `generic` | TEXT primary key; preserve identifier semantics |
| `SAMPLEID` | `source_sample_id` | Nullable INTEGER; not the primary key |
| `MISSION` | `mission_id` | Foreign key to mission vocabulary; preserve source spelling in observations |
| `STATION` | `station_raw` | Nullable TEXT |
| `LANDMARK` | `landmark_raw` | Nullable TEXT |
| `BAGNUMBER` | `bag_number` | Nullable TEXT |
| `ORIGINALWEIGHT` | `original_weight_g` | Nullable REAL for querying, exact source value retained |
| `SAMPLETYPE` | `sample_type` | Nullable TEXT, original vocabulary |
| `SAMPLESUBTYPE` | `sample_subtype` | Nullable TEXT, original vocabulary |
| `PRISTINITY` | `pristine_percent` | Nullable REAL; outliers retained |
| `PRISTINITYDATE` | `pristinity_date_raw`, `pristinity_date` | Original TEXT plus parsed ISO date; no invented timezone |
| `HASTHINSECTION` | `has_thin_section` | Nullable INTEGER boolean; null is not false |
| `HASDISPLAYSAMPLE` | `has_display_sample` | Nullable INTEGER boolean |
| `DISPLAYSAMPLENUMBER` | `display_sample_number_raw` | Nullable TEXT; retain even when detailed relationships are present |
| `GENERICDESCRIPTION` | `description` | Nullable TEXT |

Also store `detail_url`, `record_status` (full/stub/conflict), and first/last observed run IDs. A discovered identifier lacking details is retained as a stub with an issue, not dropped.

### Related tables

Names and columns below are a proposed model, not an assertion about NASA's original database structure.

| Table | Key and main columns | Purpose |
| --- | --- | --- |
| `missions` | `mission_id`, `name`, `program` | Mission lookup; program derived transparently |
| `vocabulary_values` | `id`, `kind`, `mission_id?`, `parent_value?`, `raw_value`, `normalized_value?` | Classifications, subtypes, stations, landmarks and source membership |
| `thin_sections` | `id`, `generic` FK, `specific` TEXT, `weight_g`, `description`, `availability_code`, `availability_label` | Specific records; test `(generic,specific)` uniqueness before enforcing it |
| `display_locations` | `location_id`, `source_location_id`, `name`, `url`, `region`, `address_line1/2/3`, `phone`, `city`, `state`, `country`, `country_id`, `latitude`, `longitude`, `zoom_level` | Preserve every observed location field, including raw coordinate strings in observations |
| `sample_displays` | `id`, `generic` FK, `specific` TEXT, `location_id` FK, `description` | One location can show several specimens; retain conflicting/duplicate source rows for review |
| `photos` | `photo_id` TEXT, `detail_url`, `mission_raw`, `photo_type`, `photo_subtype`, `film_type`, `description`, `angle_raw`, `orientation_raw`, `related_specifics_raw` | Photo metadata; leave fields nullable when absent |
| `sample_photos` | `id`, `generic` FK, `photo_id` FK, `specifics_raw`, `relationship_source`, `source_response_id`, `ordinal` | Many-to-many, retaining separately observed relationships |
| `publications` | `publication_id`, `title`, `authors_raw`, `year?`, `publication_number?`, `kind` | Catalogs, compendium entries, and other linked publications |
| `sample_publications` | `generic` FK, `publication_id` FK, `link_label`, `source_response_id`, `ordinal` | Preserve exact association and page order |
| `references` | `reference_id`, `source_reference_id?`, `authors_raw`, `year`, `title`, `citation_text`, `citation_html?`, `doi?`, `url?` | Bibliography, separate from a linked catalog document |
| `sample_references` | `generic` FK, `reference_id` FK, `source_response_id`, `ordinal` | Many-to-many bibliography relationships |
| `assets` | `asset_id`, `original_url`, `resolved_url`, `kind`, `label`, `alt_text?`, `mime_hint?` | Remote URLs only; MIME type may remain unknown |
| `photo_assets`, `publication_assets`, `page_assets` | Entity FK, `asset_id` FK, `role`, `source_response_id`, `ordinal` | Typed associations; photo roles include preview/JPEG/TIFF |
| `pages` | `page_id`, `url`, `title`, `page_type`, `main_text`, `main_html?`, `displayed_updated_raw?` | Ancillary content inventory and future route migration |
| `content_blocks` | `block_id`, `page_id` FK, `parent_block_id?`, `kind`, `ordinal`, `content_json`, `source_response_id` | Ordered renderable headings, prose, tables, lists, captions, links and asset placements |
| `content_requirements` | `requirement_id`, `source_url_or_state`, `page_type`, `section`, `expected_content`, `acquisition_source`, `local_mapping`, `target_route`, `status`, `evidence` | Content-parity matrix tying the existing experience to acquired content and the replacement |
| `page_links` | `page_id` FK, `target_url`, `link_text`, `relationship`, `ordinal` | Navigation and content graph; no external crawling implied |

Avoid splitting stations/landmarks on commas: a UI value such as `Dg, G` may be a single source label. Preserve spelling differences such as `APENNINE FRONT`/`APPENINE FRONT` and subtype spacing/case. Any normalization or aliasing must be additive and reversible.

Numeric-looking identifiers remain strings. Convert API values such as `67915.0` to `67915` only after confirming they are exactly integral; never apply general floating-point rounding to identifiers. Keep compound and range-like specific expressions intact until their grammar is established.

### Audit tables and raw evidence

| Table | Required information |
| --- | --- |
| `runs` | Run ID, start/end UTC, scope/config hash, code and schema version, status |
| `requests` | Method, URL, canonical form/query parameters, request key, queue state, attempt count |
| `responses` | Request/run IDs, final URL, HTTP status, content type, fetched UTC, ETag/Last-Modified where supplied, body path, SHA-256, outcome classification |
| `discovery_memberships` | Run, entity type/ID, discovery surface, filter/mission, source response |
| `field_observations` | Entity/field, source response, raw value, parsed value, source locator, extraction status, parser version |
| `record_evidence` | Entity/relationship key, source response and JSON path/CSS or table locator |
| `validation_issues` | Run, severity, entity/field, issue code, evidence pointers, resolution/disposition |

Model fetch and parse outcomes separately: `success_nonempty`, `success_empty`, `not_found`, `http_error`, `application_error`, `parse_error`, and `not_attempted`. Missing data is not an empty successful response. Identify HTML error documents even when the server returns HTTP 200.

Choose sources field by field for faithful reproduction of the current website. Preserve API precision and original HTML observations; use a presentation mapping for labels, units and precision. The current importer uses mapped API fields and fills missing values from HTML while retaining and reporting disagreements for presentation review. Search membership discrepancies are treated as legacy search bugs: make valid acquired records discoverable in the replacement instead of copying undocumented suppression behavior. Audit original search code separately if it becomes available. Never overwrite a known value with null from a failed or partial response. Date of extraction and date of pristinity calculation are different fields.

Use source IDs when stable. Otherwise use deterministic keys based on documented source content/relationships, retaining original source rows. Do not merge references solely by title or locations solely by name. Introduce deduplication rules only after collision checks.

## 5. Python extraction workflow

### Stage A — Establish the website baseline and acquisition coverage

1. Build the initial content-parity matrix from the current website and document representative user journeys. Then initialize a small installable Python package, HTTP session/client, HTML parser, SQLite migrations, and CLI to acquire that inventory.
2. Capture representative JSON and HTML fixtures with provenance, including every edge case above.
3. Inspect remaining lookup response shapes, empty responses, error responses, list limits and pagination. Do not invent undocumented pagination parameters.
4. For every content requirement, select an acquisition source and create its field/block/relationship mapping, parser and validation rule. If no source supplies a required item yet, record an acquisition gap; do not remove the requirement or narrow it to what the API supports.
5. Inventory route families reachable from the lunar home. Record the request budget and rate limits. No messages to site maintainers are sent automatically.

Implemented dependencies: `requests`, `beautifulsoup4`, `lxml`, standard-library `sqlite3`, `csv`, `decimal`, and `hashlib`, and `pytest` for fixture/contract tests. Versions are resolved in `/python/uv.lock`; use `uv sync` and `uv run --locked`. Begin with ordinary HTTP; browser automation is a future fallback for surfaces confirmed to require it.

### Stage B — Enumerate sample IDs independently

1. Fetch missions and vocabularies from the API and capture search-form vocabulary.
2. Fetch each mission's API records and record row counts, distinct IDs, duplicates and source membership.
3. Parse each website mission result with full form state and all observed pages/items.
4. Compare ID sets per mission and retain their union. Flag API-only and HTML-only records without assuming either source is authoritative for membership.
5. Use classification/station/landmark API listings and appropriate unfiltered/partitioned website searches to test omissions or limits. Exhaustive alternate enumeration is needed where the primary inventories cannot be reconciled; cache results to avoid repeated requests.
6. Add newly discovered sample IDs from photo metadata and ancillary indexes to a review queue. Resolve explicit identifiers through the API/detail page; ambiguous caption text remains an observation, not a fabricated record.

### Stage C — Extract samples and their related records

1. Retrieve sample details for every discovered generic and compare with the mission response. In a later optimized refresh, omit redundant detail requests only after a field-parity audit demonstrates that omission is safe.
2. Fetch both thin-section and display endpoints for every sample in the baseline run. Flags can be null or stale; they are hints, not discovery gates.
3. Fetch each sample's HTML detail page, extract all named sections, publication links, references and gallery items. Capture HTML observations for shared core fields too.
4. Read linked thin-section tables and relevant display detail/map metadata pages as needed for coverage and HTML/API checks. Request HTML metadata only.
5. Preserve unexpected fields and section labels and open schema-drift issues. Do not silently ignore new structured sections.

### Stage D — Extract the independent photo catalog

1. Start with the union of sample-gallery photo IDs.
2. Replay the website's photo search by mission and, where necessary, photo type or other verified partitions. Include a verified unfiltered search or other inventory path to cover records without a mission/sample association.
3. Inspect result-size limits, pagination controls and underlying HTML/requests. Record counts, terminal-page evidence and repeated-page detection. Verify whether all rows are already embedded before requesting additional pages.
4. Fetch each distinct photo detail URL once per run. Store metadata, explicit relationships, original related-specific text, and all supplied asset URLs.
5. Compare search results with galleries and photo details. Report photos only found through search, only through galleries, and conflicting associations.
6. If no public inventory path can expose orphan photos or a result cap cannot be exhausted, state that boundary in the report; do not claim full photo-catalog completeness.

### Stage E — Informational pages and remaining website content

Acquire every remaining item in the content-parity matrix, including catalog/compendium indexes, core metadata, special collections, references, editorial pages, contacts, archives, and public guidance/forms. Use an allowlist plus a visited/request-key set to avoid navigation loops, search permutations and unrelated NASA collections. Record outbound links without traversing their sites. Extend the schema for observed core/special-collection tables instead of forcing those records into `samples.description`. Preserve ordered content blocks and asset placements needed to render each page. This stage is required for content readiness even if the sample and photo databases are already complete.

### Stage F — Build and validate the release

1. Parse cached inputs into a staging SQLite database with foreign keys enabled and explicit transactions.
2. Generate the content-parity matrix and acquisition-gap report alongside coverage, reconciliation, field-quality and relationship reports. Demonstrate how each current page/template can be supplied from the acquired model.
3. Review the stratified pilot, then run the full inventory under the configured request budget.
4. Resolve extraction defects; retain genuine source discrepancies with evidence and disposition.
5. Export SQLite, related CSVs, a data dictionary, and a release manifest with hashes. Promote a complete release atomically; do not present a partially refreshed database as complete.

## 6. Request behavior and reproducibility

- Start with one in-flight request and at least one second between requests to the host. Estimate total requests from discovered samples/photos and adjust the run schedule, not the source workload assumptions.
- Use an identifiable configurable User-Agent. Set connection/read timeouts; bounded retries with exponential backoff and jitter for transient failures; honor `Retry-After` and stop repeated denial/error patterns.
- Cache by method + normalized URL + ordered/multivalue request parameters. A URL alone cannot distinguish different POST searches. Preserve original request data for reproduction.
- Persist the queue and each outcome so interruption/resume does not restart the harvest. Bound attempts and report permanently failed items.
- Inspect content type before saving bodies and never follow asset links as crawl targets. Record asset URLs without downloading them. Optional future link-health checks must remain separate from extraction and avoid GET fallbacks that download assets.
- Retain original and resolved URLs, query strings and meaningful fragments. Resolve relative paths against the final response URL. Do not blindly rewrite HTTP links to HTTPS or invent higher-resolution paths.
- Keep raw responses immutable; reparse locally when fixing selectors. Version schema and parsers, and capture configuration, timestamps and hashes in each run manifest.
- Refresh into a new run; compare added, changed and missing records. Do not delete records merely because they are absent from one failed or incomplete refresh. No delta/updated-since API was established in this inspection.

## 7. How we will assess content readiness and website parity

Use two gates: acquisition readiness before the full React build, and user-visible parity before launch. Acquisition readiness requires a renderable local representation or preserved remote asset destination for every inventoried content requirement. Launch requires demonstrating that the replacement actually presents that content and lets users reach it. Database counts alone satisfy neither gate.

### Required report outputs

| Report | What it must establish |
| --- | --- |
| `content-parity.csv` | Every current page/section or dynamic template/record inventory, its required content, acquisition mapping, target route, status and evidence |
| `content-gaps.md` | Missing content, unavailable acquisition sources, unresolved presentation conflicts and affected user journeys |
| `coverage.md` and `coverage.json` | Discovered, attempted, parsed, empty, failed and unattempted entities by source, mission and route family |
| `source-differences.csv` | Exact API-only/HTML-only IDs, field disagreements, related-record differences and dispositions |
| `field-coverage.csv` | Per-field presence, source nulls, parse failures, unexpected values and conflicts |
| `relationship-audit.csv` | Orphan keys, duplicate links, ambiguous specifics, photo association conflicts and unprocessed targets |
| `asset-links.csv` | Remote URLs, roles, source pages and owning entities; no implication that assets were downloaded or verified reachable |
| `review-samples.csv` | Stratified review sample, source links/evidence and reviewer findings |
| `manifest.json` | Scope, source/config/parser/schema versions, time window, totals and artifact hashes |

Always report the denominator. “All fetched pages parsed” is not proof that all pages were discovered. Counts must distinguish API rows, distinct generic samples, specific specimens, photos, relationships and bibliography entries.

### Automated checks

- Every ID in the declared discovery union has a sample row and a terminal extraction state. Every discovered related detail target is accounted for.
- Compare sample IDs, not just row counts, across mission/API/web inventories. Classify API/search mismatches as legacy search bugs for the separate future audit; they must not cause records to be dropped.
- Compare shared API/HTML fields at the displayed precision. Use decimal-aware comparisons; classify source rounding, missing values and actual conflicts separately.
- Compare related-record sets and counts against raw HTML/API items, ignoring UI pagination placeholders and duplicated responsive markup.
- Check primary-key uniqueness, foreign keys, identifier normalization, date parsing, required source URLs and provenance completeness.
- Report negative weights, out-of-range percentages, unknown availability codes and inconsistent flags as source-quality findings. Preserve raw values; invalid assumptions must not erase real source data.
- Detect schema/HTML changes, truncated payloads, login/error pages, repeated pagination responses and missing expected sections.
- Rebuilding from the same cached responses must yield the same logical records and content hashes. Replaying/resuming must not duplicate records or relationships.
- Test meaningful parser contracts using saved cases: API arrays/nulls, numeric identifiers, 64476 availability, 21000 precision, 10070 outlier, large galleries/references, shared photos, full photo form serialization, and application-error responses.

### Manual review

Begin with approximately 30–50 samples stratified across all nine missions, observed classifications, zero/null values, thin sections, displays, photo-rich samples and sparse records. Include 63586, 64476, 67915, 21000, 10006 and 10070 explicitly. Review photo records from each observed type and several multi-sample captions. Compare normalized output to source fixtures and selected live pages without downloading assets.

### Acquisition acceptance criteria

- Every current-site content requirement has an acquired, renderable representation or the appropriate remote asset link and placement. Recording a gap does not count as satisfying it.
- All declared API and website discovery partitions have been processed with evidence of exhaustion, or explicitly identified as unresolved coverage gaps.
- 100% of discovered generic IDs are retained, and all required sample/related metadata targets have been successfully parsed or have documented source-unavailable outcomes.
- Zero unresolved extraction-caused missing records, dropped fields, duplicate-key failures, or broken foreign keys in the candidate release.
- All inventoried user-visible fields, sections and editorial content are mapped for presentation. Raw evidence with an extension task is unfinished acquisition work. Source limitations do not silently exclude content from the replacement's requirements.
- API/HTML discrepancies have evidence and a disposition. An authentic source anomaly may remain; an unexplained discovery cap or parsing error prevents a complete release.
- CSVs preserve the same entity counts, keys and relationships as SQLite. Define null as `\N` with an escape rule for literal `\N`; document identifier columns as text and preserve Unicode/newlines. Exact API numeric tokens remain available in raw evidence.
- The manual review finds no unresolved extraction defects, and the report clearly separates sample-catalog coverage, photo-catalog coverage and ancillary-content coverage.

### Website launch acceptance criteria

- Every inventoried page and dynamic record has an appropriate destination in the new site, including records reachable by direct detail URL but absent from some search results.
- Compare current and replacement pages for text, fields, tables, references, captions, gallery membership, images and document/download access. Layout may change; content must remain available in context.
- Verify representative journeys: mission browsing; sample-number and filtered searches; sample-to-photo and photo-to-sample navigation; thin sections and displays; compendium/catalog browsing; and finding request/return guidance and forms.
- Preserve useful filters, units, availability labels and relationships. Fix API/search membership discrepancies by searching the acquired record union; do not carry forward undocumented legacy exclusions. Preserve other field disagreements for explicit presentation review.
- Check internal links and navigation, and verify that remote images/documents are actually accessible from the new experience. Preserve accessibility information such as alt text and table headings, and test keyboard and responsive access.
- Recheck the baseline near launch for content changed since extraction. Unresolved missing user-visible content prevents a parity claim; any deliberate content removal or substitution requires an explicit scope decision.

## 8. Repository layout

Conceptual layout. The implemented Python package and actual command names are documented in `/python/README.md`; this diagram also includes later frontend work:

```text
/
  docs/
    lunar-data-extraction-plan.md
    data-dictionary.md                 # produced during implementation
  python/
    pyproject.toml
    uv.lock
    src/lunar_ingest/
      cli.py
      client.py
      discovery.py
      api.py
      html_samples.py
      html_photos.py
      html_pages.py
      normalize.py
      storage.py
      validate.py
      export.py
    migrations/
    tests/fixtures/
    tests/
  data/                               # generated; normally excluded from Git
    raw/<run_id>/
    staging/
    releases/<run_id>/
      lunar.sqlite
      csv/
      reports/
      manifest.json
  src/                                # future React application
  public/                             # future frontend public files
  package.json                        # future frontend tooling at root
```

Keep database builds and complete raw crawls out of ordinary source control. Commit small representative fixtures, migrations, the data dictionary and summary reports. Configure all output paths so the Python package works when invoked from the repository root or `/python`.

Implemented CLI examples, run from the repository root:

```text
uv run --project python --locked lunar-ingest start --mode pilot --run <id>
uv run --project python --locked lunar-ingest resume data/runs/<id>
uv run --project python --locked lunar-ingest parse data/runs/<id>
uv run --project python --locked lunar-ingest validate data/runs/<id>
uv run --project python --locked lunar-ingest export data/runs/<id>
```

## 9. Milestones and later React work

| Milestone | Deliverable | Exit condition |
| --- | --- | --- |
| 0. Reconnaissance | This plan and observed gaps | Complete for planning; remaining unknowns listed above |
| 1. Content inventory and pilot | Content-parity matrix, package, schema, fixtures, representative database/content blocks | Current page families and journeys inventoried; representative content acquired faithfully |
| 2. Full content acquisition | Cached sources, normalized database, editorial blocks, remote asset mappings, CSVs | All inventoried website content has a presentation mapping; acquisition gaps resolved |
| 3. Content readiness assessment | Parity matrix, coverage reports, discrepancy register, manual review | Acquisition acceptance criteria met; unresolved required content keeps this milestone open |
| 4. React foundation | Root-level React project, `/src`, route map, local data adapter | Accepted dataset supports representative searches and detail views |
| 5. Website recreation | Sample/photo searches, mission browsing, detail pages, publications, core/special collections, editorial pages and public guidance/forms | Website launch acceptance criteria met against the current-site baseline |
| 6. Maintenance | Repeatable refresh and release process | Changes reviewed, schema migration tested, original-source handoff supported |

For React, choose either a small read-only service over SQLite or build-generated JSON/search indexes after measuring dataset and photo volume. A conventional browser React app cannot directly use Python's SQLite connection. Avoid committing now to a backend or shipping the whole raw crawl to clients.

Build a stable view model independent of NASA's current API field casing and the scraper's audit tables. Preserve source links and extraction timestamps in the UI where useful. Render/sanitize imported HTML deliberately; retain original source HTML only as evidence. Map legacy URLs to future routes, and link remote assets using their captured URLs.

When the original database becomes available, audit it alongside the original code and implement a separate importer. Revise this public-view model through new migrations where the source reveals different entity boundaries or relationships; do not force historical data into an incorrect initial schema. Preserve public-source provenance, external-identifier mappings and stable frontend contracts so we can explain differences and migrate deliberately. See [schema-evolution.md](schema-evolution.md).

**Next implementation task:** inventory the current website's pages, content sections and user journeys in the content-parity matrix, then build a Python pilot that acquires representative examples of each content type. Expand acquisition until that inventory can be faithfully presented by the new React site.
