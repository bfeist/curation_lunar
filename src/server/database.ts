import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";
import type {
  Sample,
  Photo,
  Reference,
  Results,
  SampleDetail,
  PhotoDetail,
  EditorialPage,
  Vocabulary,
} from "../types/content.ts";
import { canonicalPagePath, nasaOrigin } from "../data/routes.ts";
import { adaptEditorial } from "./editorial.ts";
import { load } from "cheerio";

const sampleColumns = `generic id, mission, station_raw station, landmark_raw landmark, bag_number bagNumber,
 original_weight_g weight, sample_type type, sample_subtype subtype, pristine_percent pristine,
 pristinity_date pristinityDate, has_thin_section thinSections, has_display_sample displays,
 description, detail_url sourceUrl, record_status status`;
const photoColumns = `p.photo_id id, p.mission_raw mission, p.photo_type type, p.photo_subtype subtype,
 p.film_type film, p.description, p.orientation_raw orientation, p.angle_raw angle,
 p.related_specifics_raw specifics, p.detail_url sourceUrl, p.record_status status,
 (SELECT a.asset_url FROM asset_occurrences a WHERE a.page_url=p.detail_url AND a.role='img:src' ORDER BY a.ordinal LIMIT 1) preview`;

export class QueryError extends Error {}
export function pagination(params: URLSearchParams) {
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "25");
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  )
    throw new QueryError("Invalid page or page size.");
  return { page, pageSize };
}
const literalLike = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;

export class LunarDatabase {
  db: DatabaseSync;
  knownPages: Set<string>;
  previews = new Map<string, string>();
  constructor(path: string) {
    this.db = new DatabaseSync(path, { readOnly: true });
    this.db.exec("PRAGMA query_only=ON; PRAGMA busy_timeout=1000");
    // Fail at startup for a missing or incompatible dataset, rather than serving broken pages.
    for (const table of [
      "samples",
      "photos",
      "pages",
      "thin_sections",
      "sample_displays",
      "display_locations",
      "sample_photos",
      "publications",
      "sample_publications",
      "bibliographic_references",
      "sample_references",
      "asset_occurrences",
    ])
      this.db.prepare(`SELECT count(*) FROM ${table}`).get();
    this.knownPages = new Set(
      this.rows<{ url: string }>(
        "SELECT url FROM pages WHERE page_type='page'",
      ).map((p) => canonicalPagePath(new URL(p.url).pathname)),
    );
    // Gallery images are available before photo-detail enrichment. Use only
    // captured image URLs paired with their actual photo link; never guess paths.
    for (const page of this.rows<{ url: string; html: string }>(
      "SELECT url, main_html html FROM pages WHERE page_type IN ('sample_page','photo_results')",
    )) {
      const $ = load(page.html, null, false);
      $('a[href*="photoinfo.cfm"] img').each((_i, image) => {
        const img = $(image);
        const href = img.closest("a").attr("href");
        const src = img.attr("data-original") || img.attr("src");
        if (!href || !src) return;
        try {
          const id = new URL(href, page.url).searchParams.get("photo");
          const url = new URL(src, page.url);
          if (id && ["http:", "https:"].includes(url.protocol))
            this.previews.set(id, url.href);
        } catch {
          /* Malformed source URLs are omitted. */
        }
      });
    }
  }
  close() {
    this.db.close();
  }
  withPreview(photo: Photo): Photo {
    return {
      ...photo,
      preview: photo.preview ?? this.previews.get(photo.id) ?? null,
    };
  }
  rows<T>(sql: string, args: SQLInputValue[] = []): T[] {
    return this.db.prepare(sql).all(...args) as unknown as T[];
  }
  one<T>(sql: string, args: SQLInputValue[] = []): T | undefined {
    return this.db.prepare(sql).get(...args) as T | undefined;
  }
  count(table: string) {
    return this.one<{ n: number }>(`SELECT count(*) n FROM ${table}`)!.n;
  }
  vocabulary(params: URLSearchParams): Vocabulary {
    const mission = params.get("mission");
    const distinct = (table: string, column: string, filter = false) =>
      this.rows<{ value: string }>(
        `SELECT DISTINCT ${column} value FROM ${table} WHERE ${column} IS NOT NULL AND ${column} != ''${filter && mission ? " AND mission=?" : ""} ORDER BY ${column}`,
        filter && mission ? [mission] : [],
      ).map((r) => r.value);
    return {
      missions: distinct("samples", "mission"),
      types: distinct("samples", "sample_type"),
      subtypes: distinct("samples", "sample_subtype"),
      stations: distinct("samples", "station_raw", true),
      landmarks: distinct("samples", "landmark_raw", true),
      photoTypes: distinct("photos", "photo_type"),
      photoSubtypes: distinct("photos", "photo_subtype"),
      filmTypes: distinct("photos", "film_type"),
    };
  }
  samples(params: URLSearchParams): Results<Sample> {
    const { page, pageSize } = pagination(params);
    const clauses: string[] = [];
    const args: SQLInputValue[] = [];
    for (const [key, column] of [
      ["mission", "mission"],
      ["type", "sample_type"],
      ["subtype", "sample_subtype"],
      ["station", "station_raw"],
      ["landmark", "landmark_raw"],
    ]) {
      const values = params.getAll(key!).filter(Boolean);
      if (values.length) {
        clauses.push(`${column} IN (${values.map(() => "?").join(",")})`);
        args.push(...values);
      }
    }
    const q = params.get("q")?.trim();
    if (q) {
      clauses.push(
        "(generic LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')",
      );
      args.push(literalLike(q), literalLike(q));
    }
    for (const [key, column, op] of [
      ["minWeight", "original_weight_g", ">="],
      ["maxWeight", "original_weight_g", "<="],
      ["pristine", "pristine_percent", ">="],
    ]) {
      const value = params.get(key!);
      if (value !== null && value !== "") {
        if (!Number.isFinite(Number(value)) || Number(value) < 0)
          throw new QueryError("Numeric filters must be nonnegative numbers.");
        clauses.push(`${column} ${op} ?`);
        args.push(Number(value));
      }
    }
    if (params.get("thin") === "1") clauses.push("has_thin_section=1");
    if (params.get("display") === "1") clauses.push("has_display_sample=1");
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const sort =
      (
        {
          id: "generic",
          mission: "mission, generic",
          weight: "original_weight_g, generic",
          type: "sample_type, generic",
        } as Record<string, string>
      )[params.get("sort") ?? "id"] ?? "generic";
    return {
      items: this.rows<Sample>(
        `SELECT ${sampleColumns} FROM samples${where} ORDER BY ${sort} LIMIT ? OFFSET ?`,
        [...args, pageSize, (page - 1) * pageSize],
      ),
      total: this.one<{ n: number }>(
        `SELECT count(*) n FROM samples${where}`,
        args,
      )!.n,
      page,
      pageSize,
    };
  }
  sample(id: string): SampleDetail | undefined {
    const sample = this.one<Sample>(
      `SELECT ${sampleColumns} FROM samples WHERE generic=?`,
      [id],
    );
    if (!sample) return;
    return {
      sample,
      photos: this.rows<Photo>(
        `SELECT ${photoColumns} FROM photos p WHERE p.photo_id IN (SELECT photo_id FROM sample_photos WHERE generic=?) ORDER BY p.photo_id`,
        [id],
      ).map((photo) => this.withPreview(photo)),
      publications: this.rows(
        `SELECT DISTINCT p.id, coalesce(sp.label,p.title) title,p.url FROM publications p JOIN sample_publications sp ON sp.publication_id=p.id WHERE sp.generic=? ORDER BY sp.ordinal`,
        [id],
      ),
      references: this.references(
        new URLSearchParams({ sample: id, pageSize: "100" }),
      ).items,
      sections: this.rows(
        "SELECT id,specific,weight_g weight,description,availability_label availability FROM thin_sections WHERE generic=? ORDER BY CAST(specific AS INTEGER),specific",
        [id],
      ),
      locations: this.rows(
        "SELECT d.id,d.specific,l.name,l.city,l.state,l.country,l.url,d.description FROM sample_displays d LEFT JOIN display_locations l ON l.id=d.location_id WHERE d.generic=?",
        [id],
      ),
    };
  }
  photos(params: URLSearchParams): Results<Photo> {
    const { page, pageSize } = pagination(params);
    const clauses: string[] = [];
    const args: SQLInputValue[] = [];
    for (const [key, column] of [
      ["mission", "p.mission_raw"],
      ["type", "p.photo_type"],
      ["subtype", "p.photo_subtype"],
      ["film", "p.film_type"],
    ]) {
      const values = params.getAll(key!).filter(Boolean);
      if (values.length) {
        clauses.push(`${column} IN (${values.map(() => "?").join(",")})`);
        args.push(...values);
      }
    }
    if (params.get("sample")) {
      clauses.push(
        "p.photo_id IN (SELECT photo_id FROM sample_photos WHERE generic=?)",
      );
      args.push(params.get("sample")!);
    }
    if (params.get("q")) {
      clauses.push(
        "(p.photo_id LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')",
      );
      args.push(literalLike(params.get("q")!), literalLike(params.get("q")!));
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    return {
      items: this.rows<Photo>(
        `SELECT ${photoColumns} FROM photos p${where} ORDER BY p.photo_id LIMIT ? OFFSET ?`,
        [...args, pageSize, (page - 1) * pageSize],
      ).map((photo) => this.withPreview(photo)),
      total: this.one<{ n: number }>(
        `SELECT count(*) n FROM photos p${where}`,
        args,
      )!.n,
      page,
      pageSize,
    };
  }
  photo(id: string): PhotoDetail | undefined {
    const photo = this.one<Photo>(
      `SELECT ${photoColumns} FROM photos p WHERE p.photo_id=?`,
      [id],
    );
    if (!photo) return;
    return {
      photo: this.withPreview(photo),
      samples: this.rows<{ generic: string }>(
        "SELECT DISTINCT generic FROM sample_photos WHERE photo_id=? ORDER BY generic",
        [id],
      ).map((r) => r.generic),
      assets: this.rows(
        "SELECT DISTINCT asset_url url,label,alt_text alt,role FROM asset_occurrences WHERE page_url=? ORDER BY ordinal",
        [photo.sourceUrl],
      ),
    };
  }
  references(params: URLSearchParams): Results<Reference> {
    const { page, pageSize } = pagination(params);
    const clauses: string[] = [];
    const args: SQLInputValue[] = [];
    for (const [key, column] of [
      ["author", "authors_raw"],
      ["title", "title"],
      ["q", "citation_text"],
    ]) {
      if (params.get(key!)) {
        clauses.push(`${column} LIKE ? ESCAPE '\\'`);
        args.push(literalLike(params.get(key!)!));
      }
    }
    if (params.get("sample")) {
      clauses.push(
        "r.id IN (SELECT reference_id FROM sample_references WHERE generic=?)",
      );
      args.push(params.get("sample")!);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.rows<
      Omit<Reference, "links" | "samples"> & { linksJson: string }
    >(
      `SELECT r.id,authors_raw authors,year,title,citation_text citation,links_json linksJson FROM bibliographic_references r${where} ORDER BY year DESC,r.id LIMIT ? OFFSET ?`,
      [...args, pageSize, (page - 1) * pageSize],
    );
    return {
      items: rows.map(({ linksJson, ...r }) => ({
        ...r,
        links: (JSON.parse(linksJson || "[]") as string[]).filter((u) =>
          /^https?:\/\//i.test(u),
        ),
        samples: this.rows<{ generic: string }>(
          "SELECT DISTINCT generic FROM sample_references WHERE reference_id=? ORDER BY generic",
          [r.id],
        ).map((s) => s.generic),
      })),
      total: this.one<{ n: number }>(
        `SELECT count(*) n FROM bibliographic_references r${where}`,
        args,
      )!.n,
      page,
      pageSize,
    };
  }
  page(path: string): EditorialPage | undefined {
    if (/\.cfm$/i.test(path)) return;
    const canonical = canonicalPagePath(path);
    const page = this.one<{ title: string; url: string; html: string }>(
      "SELECT title,url,main_html html FROM pages WHERE lower(url)=? AND page_type='page'",
      [nasaOrigin + canonical.replace(/\.NOTcfm$/, ".cfm")],
    );
    if (!page) return;
    return {
      title: page.title,
      sourceUrl: page.url,
      html: adaptEditorial(page.html, page.url, this.knownPages),
    };
  }
  catalogPdfs(): EditorialPage | undefined {
    const page = this.one<{ url: string; html: string }>(
      "SELECT url,main_html html FROM pages WHERE page_type='catalog' LIMIT 1",
    );
    if (!page) return;
    const $ = load(page.html, null, false);
    return {
      title: "PDF Catalogs",
      sourceUrl: page.url,
      html: adaptEditorial(
        $("#tabs-5").html() ?? "",
        page.url,
        this.knownPages,
      ),
    };
  }
}
