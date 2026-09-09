import express from "express";
import type { ErrorRequestHandler } from "express";
import { LunarDatabase, QueryError } from "./database.ts";

export function createApp(database: LunarDatabase, label: string) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", (req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res
        .set("Allow", "GET, HEAD")
        .status(405)
        .json({ error: "This is a read-only service." });
      return;
    }
    next();
  });
  const params = (url: string) => new URL(url, "http://localhost").searchParams;
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "ok",
      dataset: label,
      samples: database.count("samples"),
    }),
  );
  app.get("/api/dataset", (_req, res) =>
    res.json({
      label,
      samples: database.count("samples"),
      photos: database.count("photos"),
      pages: database.knownPages.size,
    }),
  );
  app.get("/api/vocabulary", (req, res) =>
    res.json(database.vocabulary(params(req.originalUrl))),
  );
  app.get("/api/samples", (req, res) =>
    res.json(database.samples(params(req.originalUrl))),
  );
  app.get("/api/samples/:id", (req, res) => {
    const result = database.sample(req.params.id);
    res
      .status(result ? 200 : 404)
      .json(result ?? { error: "Sample not found in this dataset." });
  });
  app.get("/api/photos", (req, res) =>
    res.json(database.photos(params(req.originalUrl))),
  );
  app.get("/api/photos/:id", (req, res) => {
    const result = database.photo(req.params.id);
    res
      .status(result ? 200 : 404)
      .json(result ?? { error: "Photo not found in this dataset." });
  });
  app.get("/api/references", (req, res) =>
    res.json(database.references(params(req.originalUrl))),
  );
  app.get("/api/page", (req, res) => {
    const result = database.page(params(req.originalUrl).get("path") ?? "/");
    res.status(result ? 200 : 404).json(
      result ?? {
        error: "This page has not yet been included in the local dataset.",
      },
    );
  });
  app.get("/api/catalog-pdfs", (_req, res) => {
    const result = database.catalogPdfs();
    res
      .status(result ? 200 : 404)
      .json(
        result ?? { error: "Catalog publications have not been acquired." },
      );
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  const onError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    void _next;
    if (error instanceof QueryError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Unable to read the dataset." });
  };
  app.use(onError);
  return app;
}
