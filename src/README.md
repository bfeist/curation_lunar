# Source guide

The directory structure follows `../airt2`: React/TypeScript, Vite, Vitest, ESLint, and Prettier. The single local origin is port 3003.

- `main.tsx` mounts `App.tsx`; React Router uses demo `.NOTcfm` routes and meaningful query parameters. There are no old `.cfm` aliases or redirects. Source NASA URLs remain unchanged in the data adapter.
- `pages/` owns route-level search forms, results, sample/photo details, references, and informational pages.
- `components/` contains the shared header/sidebar/footer, tabs and pagination, gallery, and editorial renderer.
- `api/useData.ts` owns abortable API requests, loading, and errors; stale requests cannot replace another route's content.
- `types/content.ts` defines browser contracts independently of NASA field names and acquisition audit tables.
- `data/` contains route/link adaptation and navigation content.
- `server/database.ts` maps SQLite rows to the contracts and implements parameterized searches over the full retained sample union. It does not filter through legacy search membership tables.
- `server/editorial.ts` sanitizes captured editorial content, drops legacy scripts/styles, maps image placement to a small CSS vocabulary, and rewrites only implemented or retained routes locally. Public forms link to their source destination.
- `server/app.ts` implements read-only HTTP endpoints. `server/server.ts` starts Express and either Vite middleware or the production static frontend.
- `styles/global.css` recreates the original visual structure with grid/flex and one mobile breakpoint at 800px. Source stylesheets are not imported.

`npm run data:prepare` creates a separate versioned website snapshot. `npm run dev` watches server/data/type source and lets Vite handle frontend hot updates. `npm run build` creates `.local/dist`; `npm start` serves that build plus the API. See `docs/hosting.md` for the data-copy and production-startup plan.

`npm run docker:up` builds the multi-stage Docker image and starts the Node-only Compose service at http://localhost:3005. The prepared `.local/data` directory is mounted read-only and excluded from the image. Re-run that command after code changes; after a data snapshot switch, use `docker compose -f dockercompose.yml restart web`.
