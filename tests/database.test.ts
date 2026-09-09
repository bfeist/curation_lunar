import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { LunarDatabase, pagination } from "../src/server/database";
import { createApp } from "../src/server/app";
import { serveFrontend } from "../src/server/frontend";
import type { Server } from "node:http";

const directory = mkdtempSync(resolve(tmpdir(), "lunar-tests-"));
const path = resolve(directory, "test.sqlite");
let database: LunarDatabase;
let server: Server;
let base: string;
beforeAll(async () => {
  const fixture = new DatabaseSync(path);
  fixture.exec(
    readFileSync(
      "python/src/lunar_ingest/migrations/001_public_view.sql",
      "utf8",
    ),
  );
  fixture.exec(`INSERT INTO samples(generic,mission,sample_type,sample_subtype,original_weight_g,pristine_percent,has_thin_section,station_raw) VALUES
    ('63586','Apollo 16','Breccia','Impact Melt',1.98,88.43,1,'Dg, G'),
    ('10006','Apollo 11','Basalt','Fine',0,NULL,0,'1'),
    ('21000','Luna 16','Soil','<1 mm',50,25,1,'1');
    INSERT INTO photos(photo_id,detail_url) VALUES ('S72-42069','https://curator.jsc.nasa.gov/lunar/samplecatalog/photoinfo.cfm?photo=S72-42069');
    INSERT INTO sample_photos(id,generic,photo_id) VALUES ('a','63586','S72-42069'),('b','63586','S72-42069'),('c','10006','S72-42069');
    INSERT INTO thin_sections(id,generic,specific,weight_g,availability_label,source_json) VALUES ('thin','63586','4',0.01,'Available','{}');
    INSERT INTO pages(url,page_type,title,main_html) VALUES ('https://curator.jsc.nasa.gov/lunar/index.cfm','page','Lunar Samples','<p>Hello</p>');
    INSERT INTO pages(url,page_type,title,main_html) VALUES ('https://curator.jsc.nasa.gov/lunar/samplecatalog/sampleinfo.cfm?sample=63586','sample_page','Sample','<a href="photoinfo.cfm?photo=S72-42069"><img data-original="photos/observed.jpg"></a>');`);
  fixture.close();
  database = new LunarDatabase(path);
  const app = createApp(database, "Test snapshot");
  const dist = resolve(directory, ".local/dist");
  mkdirSync(dist, { recursive: true });
  writeFileSync(
    resolve(dist, "index.html"),
    "<!doctype html><title>Lunar test</title>",
  );
  writeFileSync(resolve(dist, "test.js"), "export const lunar = true;");
  serveFrontend(app, dist);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No test server port");
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  database.close();
  rmSync(directory, { recursive: true });
});

describe("read-only data contract", () => {
  it("maps demo editorial routes to source records without exposing legacy aliases", async () => {
    expect(database.page("/lunar/index.NOTcfm")?.sourceUrl).toBe(
      "https://curator.jsc.nasa.gov/lunar/index.cfm",
    );
    expect(database.page("/lunar/index.cfm")).toBeUndefined();
    expect(
      (await fetch(base + "/api/page?path=/lunar/index.NOTcfm")).status,
    ).toBe(200);
    expect((await fetch(base + "/api/page?path=/lunar/index.cfm")).status).toBe(
      404,
    );
  });
  it("serves production assets and demo deep links from a .local build directory", async () => {
    for (const path of [
      "/",
      "/lunar/samplecatalog/sampleinfo.NOTcfm?sample=63586",
    ]) {
      const response = await fetch(base + path);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("<title>Lunar test</title>");
    }
    expect(await (await fetch(base + "/test.js")).text()).toContain(
      "export const lunar",
    );
    expect((await fetch(base + "/api/missing")).status).toBe(404);
  });
  it("searches the complete sample union without legacy membership restrictions", () => {
    expect(database.samples(new URLSearchParams()).total).toBe(3);
    expect(
      database
        .samples(
          new URLSearchParams("mission=Apollo+16&mission=Luna+16&type=Soil"),
        )
        .items.map((s) => s.id),
    ).toEqual(["21000"]);
  });
  it("preserves station labels, nulls, zero weights and numeric precision", () => {
    expect(
      database.samples(
        new URLSearchParams(
          "station=Dg%2C+G&minWeight=1.98&maxWeight=1.98&thin=1",
        ),
      ).items[0]?.id,
    ).toBe("63586");
    const zero = database.sample("10006")!.sample;
    expect(zero.weight).toBe(0);
    expect(zero.pristine).toBeNull();
  });
  it("parameterizes queries and treats wildcard input literally", () => {
    expect(
      database.samples(new URLSearchParams({ q: "' OR 1=1 --" })).total,
    ).toBe(0);
    expect(database.samples(new URLSearchParams({ q: "%" })).total).toBe(0);
    expect(database.photos(new URLSearchParams({ q: "%" })).total).toBe(0);
  });
  it("bounds pages and rejects invalid numeric filters", () => {
    for (const q of ["page=0", "page=-1", "pageSize=101", "page=NaN"])
      expect(() => pagination(new URLSearchParams(q))).toThrow();
    expect(() =>
      database.samples(new URLSearchParams("minWeight=NaN")),
    ).toThrow();
    expect(
      database.samples(new URLSearchParams("pageSize=1&page=2")).items,
    ).toHaveLength(1);
  });
  it("deduplicates evidence relationships while preserving both navigation directions", () => {
    expect(database.sample("63586")!.photos).toHaveLength(1);
    expect(database.photo("S72-42069")!.samples).toEqual(["10006", "63586"]);
    expect(database.sample("63586")!.sections[0]?.specific).toBe("4");
  });
  it("uses captured gallery previews before detail enrichment", () => {
    expect(database.photo("S72-42069")!.photo.preview).toBe(
      "https://curator.jsc.nasa.gov/lunar/samplecatalog/photos/observed.jpg",
    );
    expect(database.sample("63586")!.photos[0]?.preview).toBe(
      database.photo("S72-42069")!.photo.preview,
    );
  });
  it("rejects writes at SQLite and HTTP layers", async () => {
    expect(() =>
      database.db.exec("DELETE FROM samples WHERE generic='63586'"),
    ).toThrow();
    expect(
      (await fetch(`${base}/api/samples`, { method: "POST" })).status,
    ).toBe(405);
    expect(database.count("samples")).toBe(3);
  });
  it("reports missing records and unknown API routes as JSON 404s", async () => {
    for (const route of [
      "/api/samples/missing",
      "/api/photos/missing",
      "/api/not-found",
      "/api/page?path=/missing",
    ])
      expect((await fetch(base + route)).status).toBe(404);
    expect((await fetch(`${base}/api/samples?page=bad`)).status).toBe(400);
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
  });
});
