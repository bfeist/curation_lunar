import express from "express";
import type { Express } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function serveFrontend(app: Express, dist: string) {
  if (!existsSync(resolve(dist, "index.html")))
    throw new Error("Production build missing. Run npm run build first.");
  app.use(express.static(dist, { index: false }));
  // A root-relative filename allows the build directory itself to be .local.
  app.get(/.*/, (_req, res) => res.sendFile("index.html", { root: dist }));
}
