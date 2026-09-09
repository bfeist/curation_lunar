# Local runtime and future hosting

The development server runs at **http://localhost:3003**; the Docker Compose demo runs at **http://localhost:3005** and on the host's LAN interfaces. The entire containerized app is served by Node, with no nginx. The demo domain is `https://curation.apolloinrealtime.org`, with TLS terminated by the user's separate Nginx Proxy Manager.

Demo page routes end in **`.NOTcfm`** (for example `/lunar/samplecatalog/sampleinfo.NOTcfm?sample=63586`). Actual NASA source URLs remain unchanged in SQLite and external links. Old `.cfm` app routes return 404; no compatibility redirects or aliases are implemented.

## Docker Compose demo

With Docker Desktop running Linux containers, first prepare the independent website snapshot using the local startup steps below. Then:

```powershell
npm run docker:up
# Equivalent: docker compose -f dockercompose.yml up --build --detach --wait
```

Open **http://localhost:3005**. The port mapping is `3005:3005`, publishing port 3005 on all host interfaces. Container Node listens on `0.0.0.0:3005`. For this machine, configure Nginx Proxy Manager with **scheme `http`, forward hostname/IP `192.168.0.2`, and forward port `3005`**. Keep the certificate and HTTPS settings on the reverse proxy; the Node upstream uses plain HTTP. Proxy both page and `/api/` requests to this same upstream. The application imposes no hostname allowlist.

If a proxy runs in another container on the same Docker network, it can alternatively use `web:3005` instead of its own localhost. To diagnose connectivity from the proxy machine, request `http://192.168.0.2:3005/api/health`; a successful response confirms the upstream is reachable independently of public DNS and TLS. Windows/network firewall rules must allow the proxy to reach TCP 3005. Compose does not configure DNS, the reverse proxy, or its certificate.

The root `dockercompose.yml` uses `docker/apiv1/Dockerfile` with the repository root as its build context. This multi-stage Dockerfile installs locked dependencies, builds React with Vite, and copies the production assets/server into a Node 24.11.1 runtime image. It excludes build tools from the runtime and runs as the `node` user. `.dockerignore` allowlists only build inputs, so the active scan, Python environment, raw evidence, SQLite files, Git history, and local secrets do not enter the build context.

Compose mounts the **prepared `.local/data/` directory** read-only at `/app/.local/data/`. The server reads `dataset.json` to select the versioned snapshot. This is the independent website copy, not the active acquisition database. Data is kept outside the image: copy this prepared directory (manifest and its referenced snapshot) alongside the Compose project on another machine. A missing directory fails startup instead of silently creating an empty database. The container root filesystem is also read-only; temporary files may use `/tmp`.

`docker compose -f dockercompose.yml up --wait` waits for the built-in `/api/health` check. The service restarts unless explicitly stopped. Useful commands:

```powershell
npm run docker:build       # Build the image without starting it
npm run docker:up          # Rebuild changed code and start/recreate the service
npm run docker:logs        # Follow Node logs
docker compose -f dockercompose.yml ps         # Inspect port and health status
docker compose -f dockercompose.yml restart web # Pick up a newly prepared dataset manifest
npm run docker:down        # Stop/remove this project's container and network
```

Stopping/removing the container retains the host snapshot. No host `node_modules` or host build output is mounted: code changes require rebuilding. The development process on 3003 can run alongside the container on 3005.

## Local startup

Use Node.js **24.11.1** (matching `../airt2` and CI):

```powershell
npm ci
npm run data:prepare
npm run dev
```

`data:prepare` defaults to the latest **full-run export**, `data/runs/full-2026-09-08/exports/lunar.sqlite`. It opens that export read-only, checks integrity and foreign keys, uses SQLite's backup API to make a consistent snapshot, converts the independent copy from WAL to `DELETE` journal mode for a self-contained read-only mount, hashes it, and writes `.local/data/dataset.json` pointing to the versioned `.sqlite` file. It never connects to the active full scan. The Python extractor, its environment, and its working database remain separate. Until review finishes, use a label that says the snapshot is a checkpoint or candidate.

`src/server/server.ts` is the entry point for development and production. Development mounts Vite as middleware in the same HTTP process, so the browser uses one origin and one port. React source lives under `src/components`, `src/pages`, `src/api`, `src/data`, `src/styles`, and `src/types`. Vite emits `.local/dist/`.

The application opens SQLite with `readOnly: true` and `PRAGMA query_only=ON`. API endpoints accept only GET/HEAD. The browser receives paginated JSON and sanitized editorial fragments; it never downloads the database or raw acquisition evidence. Images, PDFs, and TIFFs stay on their captured NASA/source URLs.

```powershell
# Test the production runtime locally after building.
npm run check
npm run build
npm start
```

Stop the development process first because both commands default to port 3003. `PORT` changes the port; `HOST` defaults to `127.0.0.1`. `LUNAR_DB` can point directly to an independently staged SQLite snapshot; set `LUNAR_DATASET_LABEL` with it to identify that dataset. Missing databases, incompatible tables, and missing production builds fail startup with an actionable error. `GET /api/health` verifies that the application can read the selected dataset.

## Promote a completed acquisition candidate

Wait for the full scan's acquisition/export process and the content review described in [full-scan-and-next-steps.md](full-scan-and-next-steps.md). A finished crawl alone is not acceptance.

```powershell
npm run data:prepare -- data/runs/full-2026-09-08/exports/lunar.sqlite "Reviewed full dataset - 2026-09-08"
```

Use that label only after review. The script requires an `exports/` candidate, not a working run database. It creates a new versioned snapshot, then atomically replaces the small manifest. Restart the website to switch datasets. A running process keeps its previous SQLite connection. Retain earlier files/manifests for rollback; the script does not delete previous snapshots. Generated data is ignored by Git.

## Production deployment plan

This is a **Node application with a read-only SQLite file**, not a static-only site. The old DreamHost `rsync .local/dist/` deployment would omit both its data and API, so that deploy step has been removed. CI still runs Python tests, frontend checks, and the Vite build. Frontend tests construct small temporary databases and do not depend on local scan data.

When choosing a host, confirm it can run a persistent Node 24 process behind its HTTP reverse proxy. DreamHost suitability depends on the selected service; no hosting assumptions have been verified or made here. A local demo can use the same production command.

Deploy the following as a versioned release:

1. `package.json`, `package-lock.json`, `src/server/`, its imports in `src/data/` and `src/types/`, and `.local/dist/`. Install runtime dependencies with `npm ci --omit=dev` on the host. Node 24 executes the server TypeScript directly.
2. A **separate copy of the reviewed snapshot** and its SHA-256 manifest. Transfer into a staging directory outside the public document root, verify the transferred checksum, and set `LUNAR_DB` to that immutable file. Do not copy the live crawl database, its WAL/SHM companions, queue, or raw response directory.
3. Give the service account read permission on the staged file and traversal permission on its parent directories; give it no database write permission. Logs and process state should use separate writable locations.
4. Start `node src/server/server.ts --production` with `PORT`, `HOST`, `LUNAR_DB`, and `LUNAR_DATASET_LABEL` set by the process manager, or use the Compose runtime described above. Route both `/api/*` and page requests to Node. The entry point serves the React fallback for demo `.NOTcfm` deep links.
5. Before switching traffic, require `/api/health` to report the expected dataset and sample count, load an editorial route and a sample deep link, and verify sample/photo/PDF access. Then switch the reverse proxy to the new release. Roll back by selecting the previous release and snapshot and restarting.

No production database migrations or write activity are needed. Data changes are reviewed offline and published as new files. Code, data, and their release manifests should move together to prevent schema mismatches. Back up the accepted acquisition run separately from the website release.

The earlier GitHub settings (`DREAMHOST_PRIVATE_KEY`, `DREAMHOST_HOST`, `DREAMHOST_USER`, `DREAMHOST_PATH_DEV`) may remain configured, but the workflow no longer uses them. A future deployment workflow should implement the complete release procedure after the host is selected.
