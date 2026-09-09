# Lunar Curation website reconstruction

React reconstruction of NASA's public Lunar Curation website. Python acquisition lives in `/python`; the TypeScript React application lives at the root with source under `/src`. The local implementation uses an immutable snapshot of the resumable full-run checkpoint while acquisition continues against a separate working database.

- [Project plan](docs/lunar-data-extraction-plan.md)
- [Python extractor and uv commands](python/README.md)
- [Pilot results](docs/pilot-results.md)
- [Full scan status and next steps](docs/full-scan-and-next-steps.md)
- [Full-run data assessment](docs/full-data-assessment.md)
- [Schema evolution and original-source audit](docs/schema-evolution.md)
- [Hosting and deployment](docs/hosting.md)
- [React implementation and parity review](docs/react-implementation.md)
- [NASA-inspired redesign, data assessment and next investigations](docs/new-design.md)

With Node.js 24.11.1, run `npm ci`, `npm run data:prepare`, then `npm run dev`. `data:prepare` now defaults to the latest full-run export. Open **http://localhost:3003**. Run `npm run check` and `npm run build` for frontend verification. The read-only SQLite service starts at `src/server/server.ts`.

The new catalog-centered design is at **http://localhost:3003/new** (or **http://localhost:3005/new** with Docker). It includes sample search with progressive scrolling, shareable filters, sample and photo details, references, a NASA-wide header, and detailed curation dropdowns covering every original navigation destination. It uses the same prepared snapshot and keeps images/PDFs on NASA's live hosts. No new scrape is needed. See [the redesign guide](docs/new-design.md) for implementation scope, header reuse findings, NASA review requirements, data gaps, and remaining validation.

The full run is resumable and must not be restarted. To continue it at the audited faster rate and automatically promote a finished, valid export into the app:

```powershell
powershell -NoProfile -File scripts/run-full-scan.ps1 -RunName full-2026-09-08 -Resume -PrepareApp -Delay 0.25
```

When it runs in the background, follow it with `Get-Content ../curation_lunar_data/scan-logs/full-2026-09-08-resume.stdout.log -Tail 30 -Wait`. Pressing `Ctrl+C` stops only the viewer. See the [full-run assessment](docs/full-data-assessment.md) before treating the resulting candidate as complete.

For the containerized demo, prepare the snapshot once, then run `npm run docker:up` (or `docker compose -f dockercompose.yml up --build -d --wait`). Open **http://localhost:3005**. Docker builds the frontend and runs the whole app with Node. Demo page routes use `.NOTcfm`; old `.cfm` URLs are not supported.

All Python work uses `uv`. The acquired schema models the public website and can evolve as original code/database information becomes available. API/search discrepancies are retained for a separate audit and treated as legacy search bugs rather than reproduced as hidden restrictions.

The Docker demo is available at [curation.apolloinrealtime.org](https://curation.apolloinrealtime.org) through Nginx Proxy Manager, which terminates TLS and forwards HTTP to the host on port 3005. CI checks and builds the app; automated deployment remains disabled. See [hosting.md](docs/hosting.md).
