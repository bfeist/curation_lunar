# Lunar Curation website reconstruction

React reconstruction of NASA's public Lunar Curation website. Python acquisition lives in `/python`; the TypeScript React application lives at the root with source under `/src`. The first local implementation uses a separate snapshot of the completed pilot while full acquisition continues.

- [Project plan](docs/lunar-data-extraction-plan.md)
- [Python extractor and uv commands](python/README.md)
- [Pilot results](docs/pilot-results.md)
- [Full scan status and next steps](docs/full-scan-and-next-steps.md)
- [Schema evolution and original-source audit](docs/schema-evolution.md)
- [Hosting and deployment](docs/hosting.md)
- [React implementation and parity review](docs/react-implementation.md)

With Node.js 24.11.1, run `npm ci`, `npm run data:prepare`, then `npm run dev`. Open **http://localhost:3003**. Run `npm run check` and `npm run build` for frontend verification. The read-only SQLite service starts at `src/server/server.ts`.

For the containerized demo, prepare the snapshot once, then run `npm run docker:up` (or `docker compose -f dockercompose.yml up --build -d --wait`). Open **http://localhost:3005**. Docker builds the frontend and runs the whole app with Node. Demo page routes use `.NOTcfm`; old `.cfm` URLs are not supported.

All Python work uses `uv`. The acquired schema models the public website and can evolve as original code/database information becomes available. API/search discrepancies are retained for a separate audit and treated as legacy search bugs rather than reproduced as hidden restrictions.

The Docker demo is available at [curation.apolloinrealtime.org](https://curation.apolloinrealtime.org) through Nginx Proxy Manager, which terminates TLS and forwards HTTP to the host on port 3005. CI checks and builds the app; automated deployment remains disabled. See [hosting.md](docs/hosting.md).
