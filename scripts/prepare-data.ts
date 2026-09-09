import { DatabaseSync, backup } from "node:sqlite";
import { mkdir, readFile, rename, writeFile, rm } from "node:fs/promises";
import { resolve, basename, dirname } from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

const root = resolve(import.meta.dirname, "..");
const source = resolve(
  process.argv[2] ??
    resolve(root, "data/runs/pilot-2026-09-08/exports/lunar.sqlite"),
);
// Export files are deliberate candidates. Never open the active acquisition database here.
if (basename(dirname(source)) !== "exports")
  throw new Error(
    "Use a completed exports/*.sqlite candidate, not a working scan database.",
  );
const output = resolve(root, ".local/data");
await mkdir(output, { recursive: true });
const temporary = resolve(output, `snapshot-${process.pid}.sqlite`);
const db = new DatabaseSync(source, { readOnly: true });
try {
  if (db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok")
    throw new Error("Source integrity check failed.");
  if (db.prepare("PRAGMA foreign_key_check").all().length)
    throw new Error("Source has foreign key errors.");
  await backup(db, temporary);
} finally {
  db.close();
}
const hash = createHash("sha256")
  .update(await readFile(temporary))
  .digest("hex");
const file = `lunar-${hash.slice(0, 16)}.sqlite`;
const destination = resolve(output, file);
if (existsSync(destination)) {
  const existingHash = createHash("sha256")
    .update(await readFile(destination))
    .digest("hex");
  if (existingHash !== hash)
    throw new Error("Existing snapshot hash does not match its filename.");
  await rm(temporary);
} else {
  await rename(temporary, destination);
}
const label =
  process.argv[3] ?? `${basename(dirname(dirname(source)))} — preview dataset`;
const manifest = {
  file,
  label,
  sha256: hash,
  preparedAt: new Date().toISOString(),
  source,
};
const manifestTemp = resolve(output, `dataset-${process.pid}.json`);
await writeFile(manifestTemp, JSON.stringify(manifest, null, 2) + "\n");
await rename(manifestTemp, resolve(output, "dataset.json"));
console.log(
  `Prepared ${file}. ${label}. Restart the website to use this snapshot.`,
);
