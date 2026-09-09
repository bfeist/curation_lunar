import { DatabaseSync, backup } from "node:sqlite";
import { mkdir, rename, writeFile, rm } from "node:fs/promises";
import { resolve, basename, dirname } from "node:path";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";

async function hashFile(path: string) {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

const root = resolve(import.meta.dirname, "..");
const source = resolve(
  process.argv[2] ??
    resolve(
      root,
      "../curation_lunar_data/runs/full-2026-09-08/exports/lunar.sqlite",
    ),
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
// The source uses WAL while it is being built. A website snapshot lives on a
// read-only mount, so convert the independent copy to a self-contained file.
const snapshot = new DatabaseSync(temporary);
try {
  snapshot.prepare("PRAGMA journal_mode=DELETE").get();
} finally {
  snapshot.close();
}
const hash = await hashFile(temporary);
const file = `lunar-${hash.slice(0, 16)}.sqlite`;
const destination = resolve(output, file);
if (existsSync(destination)) {
  const existingHash = await hashFile(destination);
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
