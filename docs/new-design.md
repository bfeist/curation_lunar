# Lunar Curation redesign at `/new`

The new experience puts the sample catalog at the center of Lunar Curation. It runs alongside the existing `.NOTcfm` prototype and reads the same immutable dataset. It does not start acquisition or download another asset collection.

## Open and run

Run `npm run dev` and open **http://localhost:3003/new**. The existing prepared snapshot is sufficient; do not rerun `data:prepare` or restart the scrape just to work on the design. For an initial checkout, follow the root README's setup instructions.

For the containerized application, run `npm run docker:up` and open **http://localhost:3005/new**. This rebuilds application code against the existing mounted snapshot. The original prototype remains at `/lunar/index.NOTcfm`.

## Design direction

The references are [NASAWDS](https://github.com/bruffridge/nasawds) and [NASA Glenn Labs and Test Facilities](https://www.nasa.gov/glenn-labs-and-test-facilities/), reviewed on September 9, 2026. The [NASAWDS README](https://github.com/bruffridge/nasawds/blob/master/README.md) describes a USWDS-derived NASA theme with NASA color adjustments, Helvetica headings, and an optional dark header.

The implementation adopts a black NASA masthead, NASA identity, blue action buttons, restrained red accents, strong sans-serif headings, large photographic areas, generous whitespace, and grouped navigation. It uses scoped application CSS rather than importing NASAWDS's global stylesheet into the legacy prototype. This is informed by those references, not a declaration of NASA or Section 508 certification. Obtain the program's actual approval checklist before claiming conformance.

The homepage leads with the collection, a direct catalog call to action, a large search box, and mission shortcuts. Counts come from the dataset. A sample feature and three research pathways connect browsing to scientific use. The catalog is also the first curation navigation item on every page. The header separates NASA-wide navigation from the curation navigation described below.

## NASA-wide header and curation menus

The very top follows the Glenn site's agency navigation: **Explore**, a NASA.gov search, centered NASA identity, **News & Events**, **Multimedia**, and **NASA+**. The dropdowns contain grouped live NASA destinations. The NASA search submits to NASA.gov using its public `search` query parameter; it is separate from local sample search. On smaller screens, search remains available inside Explore.

Below the agency header, the Lunar Curation title and its navigation retain the project's own identity. Each dropdown has an introduction, an overview destination, and three columns of links:

| Curation menu | Included content |
| --- | --- |
| Sample collections | Curation home; Lunar, Meteorite, Stardust, Genesis, Cosmic Dust, Microparticle Impacts, Hayabusa, Hayabusa2 and OSIRIS-REx |
| Research & resources | Sample and photo catalogs, database API, references, Apollo catalog PDFs, specially curated samples, compendium and all lunar-core sections |
| Request & learn | Curation-wide request deadlines, lunar request dates/forms, research requests and returns, education samples, public displays, curation contacts and the Apollo Lunar Surface Journal |
| Curation & news | Lunar sample facility and laboratory tour, Curation News, Astromaterials Newsletter, Lunar News, NASA/ARES, contacts and site map |

The original global links are shared through `curationNavigation` in `src/data/navigation.ts`. `src/new/navigation.ts` defines the new grouping and descriptive copy. A regression test checks every original global, collection and sidebar destination against the new menus. External collections, news and ARES destinations retain their live URLs; this change does not acquire or recreate those entire websites.

Menus open on activation, support Tab navigation, and close via Escape, a close button, outside click, focus leaving the header, or navigation. Explicit dismissal returns focus to the opener. Only one dropdown opens at a time across both navigation levels. Mobile curation menus expand within the page; NASA dropdowns have a scrollable height limit.

### Reuse investigation

The [Glenn page](https://www.nasa.gov/glenn-labs-and-test-facilities/) exposes its navigation as page content; the iframe identified by the public page reader is Google Tag Manager. No documented standalone iframe or supported syndication endpoint for that header was found. [NASAWDS header examples](https://nasa.github.io/nasawds-site/components/headers/) provide HTML/CSS/JavaScript component patterns, including multi-column menus, rather than a hosted header iframe.

Newer [NASA guidance, NAII 2800.2](https://nodis3.gsfc.nasa.gov/OPD_Docs/NAII_2800_2_.pdf), identifies **Horizon Design System** in section 7.2.1. It points to internal component documentation and collaboration with agency design/communications leads. Section 14.4 reserves detailed header/navigation guidance for future development. The next reuse investigation should obtain the approved Horizon component or integration instructions from those owners.

The current header is a local React implementation with public NASA links. It does not automatically synchronize with NASA.gov and does not load NASA's WordPress scripts or embed the full website. An approved shared header can replace `src/new/Header.tsx`'s agency section while retaining the curation menus. Review public destinations periodically, especially time-sensitive news links.

### Header asset and styling corrections

The header and footer use the standalone transparent insignia actually referenced by Glenn's header (`nasa-logo@2x.png`, served by NASA.gov). The old curation `nasa_logo.gif` includes the agency name on a wide white background and must not be squeezed into the insignia slot. Equal grid columns keep the insignia centered through desktop/tablet breakpoints. Dropdown indicators are borderless SVG chevrons; the buttons explicitly suppress native backgrounds and borders while retaining visible keyboard focus. These corrections were checked against the source assets and code; the requested full browser review remains unperformed because the browser tool fails its admin-policy verification before opening localhost.

## Routes and interactions

| Route | Purpose |
| --- | --- |
| `/new` | Catalog search, mission shortcuts, featured sample and research pathways |
| `/new/catalog` | Sample search, multiple missions, classification, thin sections, displays, collection site, mass and pristinity filters |
| `/new/samples/:id` | Photography, properties, source record, publications, thin sections, displays and research |
| `/new/photos` | Photographic search and sample-specific galleries |
| `/new/photos/:id` | Image, captured metadata, associated samples and original asset links |
| `/new/references` | Citation search and sample-linked literature |
| `/new/page?path=…` | Collection, request, education and publication content within the new shell |

Search/filter state is encoded in the URL, including repeated mission parameters. Example: `/new/catalog?mission=Apollo+11&mission=Apollo+12&thin=1`. Legacy page-number parameters are discarded for new result streams. Sort options are sample number, mission, type, and ascending mass. Numeric properties apply together using an explicit button.

Results load in batches of 24. An intersection observer loads the next batch near the end of the current results. Automatic loading pauses at every third batch so the footer stays reachable; “Load more” continues browsing. Users can turn off automatic loading and use the button throughout. Errors have a retry action; empty results suggest broadening the search. Replacing a query unmounts and aborts the old request stream, so late responses cannot mix unrelated results. Already-present IDs are deduplicated. Images load lazily; failed or missing images have an explicit fallback.

Accessibility provisions include a skip link, labeled controls, native collapsible filter sections, visible focus styles, keyboard-operable menus with Escape dismissal, live result counts, table captions, and reduced-motion handling. On small screens navigation becomes a menu and catalog filters start collapsed. Hands-on accessibility testing is still required.

## Asset and data boundaries

Photographs, NASA logos, PDFs, and downloads retain their original hosted URLs. The homepage hero uses NASA Johnson's [jsc2004e20304 panorama on Flickr](https://www.flickr.com/photos/nasa2explore/9672172187/), served directly from its [9,000 × 1,066 original](https://live.staticflickr.com/7320/9672172187_20cae06251_o.jpg) (approximately 1.92 MB). The original replaces the small `cropped-astro-soil.jpg` that became pixelated when expanded across the hero. An eagerly loaded image with high fetch priority uses `object-fit: cover`, centered at 50% on desktop and 60% on mobile. The 520–530px desktop hero preserves approximately two source pixels per displayed vertical pixel on typical screens. No cropped copy is hosted by this app. The visible credit links to the source and its listed CC BY-NC 2.0 license and identifies the crop.

The homepage sample feature continues to use the collection's `64435.jpg`; that known editorial image is also a fallback on sample 64435's detail page. No photo ID or missing scientific metadata is invented for it.

Catalog thumbnails are resolved once when the read-only service opens the snapshot, using captured sample/photo relationships and observed gallery image URLs. There is no per-card detail fetch and no outbound acquisition from the app. The sample response gains an optional `preview`; the original prototype remains compatible. Photo mission filters use actual photographic mission values, rather than assuming all sample missions have populated photo metadata.

Thumbnail selection prefers ordinary sample photography over thin sections and microscope/polarized-light images. It uses captured gallery alt text and link titles as well as enriched photo metadata, so it works with stub records. Whole-sample/surface views and color photographs receive a modest preference; group/tray images rank lower. Unclassified images precede known thin sections, which remain a fallback when no other observed image is available. The photo library and sample galleries retain all photographs.

The editorial API now retains query parameters when resolving pages. This matters for distinct resources such as `corephotos.NOTcfm?core=10004`. HTML still goes through the existing sanitizer. The browser adapter only maps local page links into `/new`; image and download URLs stay untouched. Uncaptured resources offer the original NASA destination. Existing `.cfm` application aliases remain unsupported.

## Data assessment for the design

Assessment of prepared snapshot `lunar-bc18a3df1b9af10a.sqlite`, September 9, 2026. Background acquisition may have advanced beyond this snapshot.

| Observation | Count | Implication |
| --- | ---: | --- |
| Sample records | 2,511 | Full API sample union available for search |
| Samples with captured HTML detail | 510 | Most records still depend on API fields |
| Samples with an observed gallery thumbnail | 374 | About 14.9% image coverage; missing imagery is expected |
| Photographic records | 19,769 | All are stubs; record count does not imply enriched photography |
| Thin-section records | 14,247 | Recorded availability must not imply current allocation availability |
| Public-display relationships | 82 | Captured locations are not a verified visitor directory |
| Bibliographic references | 286 | Literature coverage remains incomplete |
| Editorial page records, including query variants | 97 | Core-photo variants must retain their query identity |

Pristinity fields include historical dates and must not be presented as current availability. Vocabulary contains spelling, case, spacing and trailing-whitespace variants, including `Soil`/`Soil ` and `1-2 mm`/`1-2mm`. This version preserves underlying distinctions. Before merging terms in the interface, define a reviewed normalization mapping retaining source values and evidence. Missing related rows do not establish that NASA has no photographs, sections, displays, or publications.

Continue the existing resumable acquisition process. A redesign or missing image is not a reason to restart the full scrape. See [the full-run data assessment](full-data-assessment.md) for monitoring, enrichment priorities, and snapshot promotion.

## Required next investigations

1. **NASA review:** use NAII 2800.2 Appendix C as a starting point and confirm applicability with the project owner. Obtain the approved Horizon header integration and decisions on masthead, banner wording, logo use, typography, footer links, contacts and metadata. The reference website alone is not a requirements document.
2. **Browser and accessibility review:** inspect desktop, tablet, mobile, 200% zoom, keyboard use, screen-reader announcements, menu focus, contrast and touch targets. Validate scrolling, retry, fast filter changes and browser Back. Browser automation was unavailable during implementation because its admin-policy verification failed for the NASA reference and localhost. No visual or screen-reader pass is claimed.
3. **Enrichment:** promote a validated later checkpoint and remeasure thumbnail, photo-detail and citation coverage. Verify sample 64435's relationships when acquired. Separate unavailable remote images from missing source URLs. Keep assets external.
4. **Research usability:** test exact-number and exploratory searches with researchers. Determine which properties deserve first-class filters, whether a compact list/table view is needed, and whether relevance ranking helps. Evaluate restoring loaded batches and scroll position when returning from a sample; currently filter URLs survive but the stream restarts at its first batch.
5. **Vocabulary and semantics:** reconcile source variants and collection-site labels with curatorial input. Decide how to communicate historical pristinity and allocation availability. Add facet counts after settling their semantics.
6. **Editorial migration:** resources currently reuse sanitized captured content. Rewrite long pages into purpose-built sections, review heading hierarchy and tables, and audit source-only destinations, PDFs, forms and contact links. Do not reproduce obsolete submission forms without a supported service.
7. **Performance:** profile snapshot loading and photo previews on the completed dataset. Consider persisted preview metadata and result virtualization if long sessions warrant it. Audit actual NASA image payload sizes and caching; avoid copying all assets or fetching detail for every card.

## Validation and implementation

Run `npm run check` and `npm run build`. Regression coverage includes thumbnail associations without duplicate samples, successive result batches, new deep-link fallback, query-specific editorial lookup, external asset preservation, sample/photo/reference link migration, and retained repeated filters with legacy pagination removed. Navigation tests check complete legacy destination coverage, separate agency/curation landmarks, disclosure targets, unique IDs, expanded panel markup, and NASA search routing. Existing read-only, input-validation and sanitization tests also apply. Rendered-markup checks do not replace browser interaction and accessibility testing; browser automation remained blocked by its policy-verification failure during the navigation update.

Components live in `src/new`, route adaptation in `src/data/redesign.ts`, and the service remains in `src/server`. All new styles are scoped under `.new-site` so the original interface remains available for comparison.
