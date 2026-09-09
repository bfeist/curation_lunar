import { describe, expect, it } from "vitest";
import { catalogQuery, redesignUrl } from "../src/data/redesign";
import { adaptEditorial } from "../src/server/editorial";
import { load } from "cheerio";

describe("redesign navigation", () => {
  it("keeps sample, photo and thin-section links within /new", () => {
    expect(
      redesignUrl("/lunar/samplecatalog/sampleinfo.NOTcfm?sample=10003"),
    ).toBe("/new/samples/10003");
    expect(
      redesignUrl("/lunar/samplecatalog/thinsections.NOTcfm?sample=10003"),
    ).toBe("/new/samples/10003#sections");
    expect(
      redesignUrl("/lunar/samplecatalog/photoinfo.NOTcfm?photo=S72-42069"),
    ).toBe("/new/photos/S72-42069");
    expect(
      redesignUrl(
        "/lunar/samplecatalog/sample_results_list.NOTcfm?mission=Apollo+11&thin=1",
      ),
    ).toBe("/new/catalog?mission=Apollo+11&thin=1");
    expect(redesignUrl("/lunar/references/index.NOTcfm?sample=10003")).toBe(
      "/new/references?sample=10003",
    );
  });
  it("preserves query-specific core resources and anchors through both adapters", () => {
    const path = "/lunar/cores/corephotos.NOTcfm";
    const html = adaptEditorial(
      '<a href="corephotos.cfm?core=10004#photo">Core</a>',
      "https://curator.jsc.nasa.gov/lunar/cores/cores.cfm",
      new Set([path]),
    );
    const href = load(html)("a").attr("href")!;
    const redesigned = new URL(redesignUrl(href), "http://localhost");
    expect(redesigned.pathname).toBe("/new/page");
    expect(redesigned.searchParams.get("path")).toBe(path + "?core=10004");
    expect(redesigned.hash).toBe("#photo");
  });
  it("never moves external assets or unacquired source pages into the app", () => {
    for (const href of [
      "https://curator.jsc.nasa.gov/lunar/unknown.cfm",
      "https://curator.jsc.nasa.gov/lunar/catalog.pdf",
      "https://curator.jsc.nasa.gov/lunar/_images/64435.jpg",
      "//images.nasa.gov/image.jpg",
      "/lunar/catalog.pdf",
      "#section",
      "mailto:curator@example.com",
    ])
      expect(redesignUrl(href)).toBe(href);
  });
  it("starts shared searches from the first batch while retaining repeated filters", () => {
    const original = new URLSearchParams(
      "mission=Apollo+11&mission=Apollo+12&page=8&pageSize=100&q=soil&thin=1",
    );
    const query = new URLSearchParams(catalogQuery(original));
    expect(query.has("page")).toBe(false);
    expect(query.has("pageSize")).toBe(false);
    expect(query.getAll("mission")).toEqual(["Apollo 11", "Apollo 12"]);
    expect(query.get("q")).toBe("soil");
    expect(query.get("thin")).toBe("1");
    expect(original.get("page")).toBe("8");
  });
});
