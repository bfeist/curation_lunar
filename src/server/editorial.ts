import { load } from "cheerio";
import sanitizeHtml from "sanitize-html";
import { presentationUrl } from "../data/routes.ts";

/** Preserve semantic content and image placement, discarding legacy layout and scripts. */
export function adaptEditorial(
  html: string,
  sourceUrl: string,
  knownPages: Set<string>,
): string {
  const $ = load(html, null, false);
  if (new URL(sourceUrl).pathname.toLowerCase() === "/lunar/index.cfm") {
    $("blockquote").each((_i, el) => {
      const quote = $(el);
      const paragraph = quote.next("p");
      const section = $('<section class="home-section">');
      quote.before(section);
      section.append(quote);
      section.append(paragraph);
    });
  }
  $("script, style, noscript, iframe, object, embed").remove();
  $("form").each((_i, el) => {
    $(el).replaceWith(
      $("<p>").append(
        $("<a>")
          .attr("href", sourceUrl)
          .attr("data-original-form", "true")
          .text("Open the original form on NASA’s website"),
      ),
    );
  });
  $("[class]").each((_i, el) => {
    const node = $(el);
    const classes = node.attr("class") ?? "";
    if (classes === "home-section") return;
    const mapped = /caption.*left|float.*left/.test(classes)
      ? "figure-left"
      : /caption.*right|float.*right/.test(classes)
        ? "figure-right"
        : /caption/.test(classes)
          ? "figure-center"
          : /section/.test(classes)
            ? "section"
            : "";
    node.attr("class", mapped);
  });
  $("a[href]").each((_i, el) => {
    const node = $(el);
    if (node.attr("data-original-form")) return;
    node.attr(
      "href",
      presentationUrl(node.attr("href") ?? "", sourceUrl, knownPages),
    );
    node.removeAttr("target");
  });
  $("img").each((_i, el) => {
    const node = $(el);
    const raw =
      node.attr("src") ||
      node.attr("data-original") ||
      node.attr("data-src") ||
      "";
    try {
      const url = new URL(raw, sourceUrl);
      node.attr(
        "src",
        ["http:", "https:"].includes(url.protocol) ? url.href : "",
      );
    } catch {
      node.remove();
    }
    node.attr("loading", "lazy");
  });
  return sanitizeHtml($.html(), {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "figure",
      "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "title", "id", "name"],
      img: ["src", "alt", "width", "height", "loading"],
      "*": ["id", "class"],
      td: ["colspan", "rowspan", "class"],
      th: ["colspan", "rowspan", "scope", "class"],
    },
    allowedClasses: {
      "*": [
        "figure-left",
        "figure-right",
        "figure-center",
        "section",
        "home-section",
      ],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  });
}
