import { describe, expect, it } from "vitest";
import { adaptEditorial } from "../src/server/editorial";
import {
  presentationUrl,
  canonicalPagePath,
  catalogPath,
  samplePath,
  photoPath,
} from "../src/data/routes";
import { navigation, collections } from "../src/data/navigation";

const base = "https://curator.jsc.nasa.gov/lunar/index.cfm";
const pages = new Set(["/lunar/index.NOTcfm", "/lunar/laboratory_tour.NOTcfm"]);
describe("editorial presentation boundary", () => {
  it("uses .NOTcfm for demo routes while retaining actual NASA source URLs", () => {
    expect(canonicalPagePath("/lunar/index.cfm")).toBe("/lunar/index.NOTcfm");
    expect(canonicalPagePath("/Lunar/index.NOTcfm")).toBe(
      "/lunar/index.NOTcfm",
    );
    for (const path of [
      catalogPath,
      samplePath("63586"),
      photoPath("S72-42069"),
      ...navigation.flatMap((group) => group.links.map(([, url]) => url!)),
      ...collections.map(([, url]) => url!),
    ].filter((path) => path.startsWith("/"))) {
      expect(path).toContain(".NOTcfm");
      expect(path).not.toMatch(/\.cfm(?:\?|$)/i);
    }
  });
  it("retains captions, remote assets and internal navigation without legacy styles", () => {
    const html = adaptEditorial(
      '<blockquote class="caption_200_left" style="width:900px"><img src="_images/rock.jpg" alt="Rock"><p>Rock caption</p></blockquote><a href="laboratory_tour.cfm">Tour</a><a href="catalog.pdf">PDF</a>',
      base,
      pages,
    );
    expect(html).toContain('class="figure-left"');
    expect(html).toContain("Rock caption");
    expect(html).toContain(
      'src="https://curator.jsc.nasa.gov/lunar/_images/rock.jpg"',
    );
    expect(html).toContain('href="/lunar/laboratory_tour.NOTcfm"');
    expect(html).toContain(
      'href="https://curator.jsc.nasa.gov/lunar/catalog.pdf"',
    );
    expect(html).not.toContain("style=");
  });
  it("removes scripts, event handlers, embedded code and unsafe URLs", () => {
    const html = adaptEditorial(
      '<script>alert(1)</script><img src="x.jpg" onerror="alert(2)"><a href="javascript:alert(3)">Bad</a><iframe src="https://example.com"></iframe><div style="position:fixed">Text</div>',
      base,
      pages,
    );
    for (const unsafe of ["<script", "alert(", "onerror", "<iframe", "style="])
      expect(html).not.toContain(unsafe);
  });
  it("keeps unacquired content on the source and maps detail and anchor routes", () => {
    expect(presentationUrl("unacquired.cfm", base, pages)).toBe(
      "https://curator.jsc.nasa.gov/lunar/unacquired.cfm",
    );
    expect(
      presentationUrl(
        "samplecatalog/photoinfo.cfm?photo=S72-42069",
        base,
        pages,
      ),
    ).toBe("/lunar/samplecatalog/photoinfo.NOTcfm?photo=S72-42069");
    expect(presentationUrl("#part2", base, pages)).toBe("#part2");
  });
  it("replaces legacy submission forms with their original destination", () => {
    const html = adaptEditorial(
      '<form action="/send"><input name="email"><button>Send</button></form>',
      base,
      pages,
    );
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).toContain(base);
  });
});
