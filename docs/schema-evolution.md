# Evolving the public-view schema when original sources become available

The project reverse engineers NASA's **currently viewable public Lunar Curation website**. Its SQLite model is a working representation of that experience. It is not a claim to have recovered the original Apollo-era schema, historical curation rules, or every specimen subdivision.

The user's context is that the underlying data structure and curation process have evolved over many decades. We therefore preserve what a source actually says, including ambiguous identifiers, nulls, unusual values, overlapping classifications and inconsistent relationships. We do not silently modernize historical meanings.

## Current decisions

- API/search membership discrepancies are treated as legacy search bugs. Keep the acquired record union available for the replacement's search. Evidence of old results is retained for a separate audit when code becomes available.
- Raw JSON and HTML responses are immutable and hash-checked. Parsed fields and relationships point back to their responses and source locations.
- The first schema lives in `python/src/lunar_ingest/migrations/001_public_view.sql`. SQLite records each applied migration and its checksum. Never edit an applied migration; add a numbered migration.
- Unknown API keys remain in raw records and field observations and generate schema-drift issues. Unmodeled page structures remain in content blocks, tables, forms and source HTML and require presentation review.
- `GENERIC` is the working public sample identifier. `SAMPLEID` is nullable and is not assumed to be an authoritative primary key. Specific numbers and photo identifiers remain text.
- Import runs have separate directories, configurations and immutable source snapshots. A newer run does not silently replace an accepted dataset.

## Separate original-source audit

1. Register the original export/code revision, date, schema version and provenance. Work from a copy and document which period and curation system it represents.
2. Inventory original tables, views, stored procedures, constraints, lookup histories and code paths. Determine which structures feed the current public website and which support internal or historical workflows.
3. Map original identifiers to public identifiers. Add a source-system identifier/crosswalk table when needed; do not assume similarly named columns are equivalent or that one public record equals one original row.
4. Compare sample and specimen cardinalities, relationships, units, null meanings, availability states and classification vocabularies. Revisit the current sample/generic/specific boundaries with evidence.
5. Audit API/search discrepancies against original queries in a separate report. Document intentional historical behavior if discovered; do not automatically reintroduce it into the new public search.
6. Classify each difference as additional content, parser defect, source bug, historical change, changed semantics, or an internal-only field. Original database availability does not itself authorize publishing internal-only information.

## Migration process

1. Write the discovered facts and proposed mapping change in a short decision note with source evidence and affected pages/records.
2. Add the next numbered SQL migration. Prefer new columns/tables and backfilled relationships before removing obsolete fields. For a necessary SQLite table rebuild, test data and foreign-key preservation on a copy.
3. Implement an importer for the original source separately from the public API/HTML adapters. Keep source values and identifiers attached to the imported records.
4. Rebuild from cached public evidence and import the original data into a new candidate run/database. Retain the old run intact for rollback and comparison.
5. Compare entity counts, key mappings, relationships, precision and all current content requirements. Test migration of an existing database as well as creation from scratch.
6. Update the data dictionary, parser/model version and presentation adapter. Preserve stable React-facing contracts where possible; version any breaking contract deliberately.
7. Promote the candidate only after the changes and public-content consequences are reviewed. Record the migration/export hashes and the superseded dataset.

Schema revisions are expected. The success criterion remains a faithful, usable new public website, with enough provenance to explain what changed as our knowledge improves.
