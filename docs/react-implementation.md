# First React implementation

Implemented September 8, 2026. This supersedes the earlier plan's instruction to wait for acquisition before starting React: the user requested local UI development while the full Python scan continues. No Python files, acquisition processes, or active run databases were changed during this implementation.

## Scope and data

The React app runs at **http://localhost:3003**, with a read-only Node/SQLite service at `src/server/server.ts`. Structure and tooling follow `../airt2`. The local website uses a consistent copy of the completed pilot export, not the active full scan. Its 2,511 sample records cover all nine mission inventories; detailed enrichment remains limited to the pilot. The prepared SQLite copy is about 32.7 MB.

| Journey | First implementation |
| --- | --- |
| Lunar homepage and sidebar | Original banner, remote imagery, text/captions, blue accordion navigation, gray centered frame |
| Sample search | Generic/description, multiple missions/types, subtype, station, landmark, weight bounds, pristine percentage, thin-section and display filters; paginated/sortable union of acquired records |
| Mission browsing | All nine missions, linked to the same local sample search |
| Sample details | Metadata, availability, publication links, thin-section rows, display locations, photo gallery, and references |
| Photo search and details | Mission/type/subtype/film/sample filters, previews, metadata, associated sample links, original JPEG/TIFF download links |
| Galleries | Five desktop columns, two mobile columns; number/description filters, sorting, page size, and pagination across all acquired relationships |
| References | Sample, author, title, and keyword search with associated-sample navigation |
| PDF catalogs | Full captured catalog tab with publication numbers, authors, and original document links |
| Informational content | 25 captured routes including requests/returns, facility/tour, display listing, catalogs, cores, special collections, compendium, newsletter index, contacts, and education guidance |
| Demo routes | App pages use `.NOTcfm`; the production server supplies the SPA entry for direct navigation. Original `.cfm` routes return 404, with no aliases or redirects. |

The presentation adapter retains semantic editorial text/tables/captions, strips scripts and inline styles, and maps image placement to a small CSS vocabulary. It rewrites known routes locally and leaves unacquired pages and remote documents on NASA. The raw acquisition HTML is not executed. Forms with external submission behavior link back to their original page.

## Visual approach

Live NASA pages and the local React pages were opened in Chrome for comparison. The page frame, lunar header, font choices, spacing, sidebar buttons, catalog fieldsets/tabs, sample tables, photo layout, gallery columns, and footer were adjusted against the rendered source. Source CSS is not imported. The implementation uses one mobile breakpoint at **800px**, stacks the navigation/content and search fields, and confines wide result tables to horizontal scroll containers.

Intentional differences: the header search searches the local catalog instead of embedding Google; the footer identifies the demo and dataset; gallery controls use native inputs; missing acquisition data is labeled; and mobile layout is simplified. Original database search omissions are not reproduced.

## Verification

- `npm run check`: TypeScript, ESLint, Prettier, and 15 Vitest tests. Tests cover search union/filter semantics, literal wildcard and injection handling, precision/null/zero preservation, pagination validation, relationships, captured previews, read-only database/API behavior, sanitization/link rewriting, and production deep links under `.local`.
- `npm run build`: production frontend generated at `.local/dist/`.
- Docker Compose build/start verified on port 3005: healthy Node runtime as a non-root user, read-only snapshot mount, frontend assets and API responses, all 25 editorial routes, and HTTP 404 for old `.cfm` routes.
- Production startup smoke check on temporary port 3004: homepage, sample deep link, built JS/CSS, health, sample/photo/reference APIs, and PDF catalog endpoint returned HTTP 200. All 25 editorial routes returned renderable content.
- Browser interactions checked: sample `63586` search, sample detail, two thin sections, linked photo `S72-42069`, JPEG/TIFF links, and Luna 16 mission browsing (15 retained records).
- Large-gallery check: sample `67915` has 148 acquired photos. Selecting 100 per page and moving to the next page displays the remaining 48; none are silently truncated.
- All six enriched pilot samples inspected through the application adapter: `63586` (7 previews), `64476` (61), `67915` (148), `21000` (0), `10006` (0), and `10070` (36). Every acquired gallery photo has a captured preview URL. Zero here describes the pilot evidence, not an assertion that no source photos exist.
- Mobile browser checks at 390 × 844: catalog controls stack, mission selection works, and photo content fits the narrow layout. Temporary browser viewport overrides were reset.
- Snapshot preparation was repeated while the website was open; the existing matching snapshot is reused without overwriting the open database.

## Remaining acceptance work

This is a working first implementation, not a declaration that the full website/data parity milestone is complete. Finish the acquisition/review steps in [full-scan-and-next-steps.md](full-scan-and-next-steps.md), then prepare a reviewed full snapshot and repeat representative journeys. Newsletter issue bodies and some linked catalog volumes are absent from the pilot and currently open on NASA. Rich legacy embedded maps/widgets are not recreated; captured display listings and source links remain accessible. Gallery list/table view toggles are not reproduced. Remote asset availability still depends on NASA/source hosts.

Reconcile every section in the final `content-parity.csv`, audit full-dataset relationship coverage and query performance, and extend the editorial adapter where new content structures need it. Visual checking so far is representative; every informational route has been checked for rendering, but not individually certified for visual parity.

Public hosting is deferred. The local Docker Compose setup builds and runs the Node-only app at port 3005 with the prepared database mounted read-only. [hosting.md](hosting.md) specifies container commands, snapshot copying, checksums, read permissions, startup checks, and rollback. The incomplete static-only deploy step was removed so a push cannot publish a frontend without its API/data. No public deployment or Git push was performed.
