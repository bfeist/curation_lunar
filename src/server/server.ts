import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LunarDatabase } from "./database.ts";
import { createApp } from "./app.ts";
import { serveFrontend } from "./frontend.ts";

const root = resolve(import.meta.dirname, "../..");
const manifestPath = resolve(root, ".local/data/dataset.json");
const manifest = existsSync(manifestPath)
  ? (JSON.parse(readFileSync(manifestPath, "utf8")) as {
      file: string;
      label: string;
    })
  : undefined;
const databasePath = process.env.LUNAR_DB
  ? resolve(process.env.LUNAR_DB)
  : manifest
    ? resolve(root, ".local/data", manifest.file)
    : "";
if (!databasePath || !existsSync(databasePath))
  throw new Error(
    "No website snapshot found. Run npm run data:prepare, or set LUNAR_DB to a reviewed SQLite export.",
  );
const database = new LunarDatabase(databasePath);
const app = createApp(
  database,
  process.env.LUNAR_DATASET_LABEL ?? manifest?.label ?? "Local dataset",
);
// The demo has no legacy .cfm route aliases or redirects.
app.use((req, res, next) => {
  if (/\.cfm$/i.test(req.path)) {
    res.status(404).type("text").send("Not found");
    return;
  }
  next();
});
const production = process.argv.includes("--production");
let vite:
  Awaited<ReturnType<(typeof import("vite"))["createServer"]>> | undefined;
if (production) {
  const dist = resolve(root, ".local/dist");
  serveFrontend(app, dist);
} else {
  const { createServer } = await import("vite");
  vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT ?? 3003);
const server = app.listen(port, process.env.HOST ?? "127.0.0.1", () =>
  console.log(
    `Lunar Curation: http://localhost:${port} (${production ? "production" : "development"}; read-only dataset)`,
  ),
);
server.on("error", (error) => {
  console.error(error);
  database.close();
  void vite?.close();
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    server.close(() => {
      database.close();
      void vite?.close().then(() => process.exit(0));
      if (!vite) process.exit(0);
    });
  });
