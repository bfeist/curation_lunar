export const nasaOrigin = "https://curator.jsc.nasa.gov";
export const catalogPath = "/lunar/samplecatalog/index.NOTcfm";
export const samplePath = (id: string) =>
  `/lunar/samplecatalog/sampleinfo.NOTcfm?sample=${encodeURIComponent(id)}`;
export const photoPath = (id: string) =>
  `/lunar/samplecatalog/photoinfo.NOTcfm?photo=${encodeURIComponent(id)}`;

export function canonicalPagePath(path: string): string {
  const lower = path.toLowerCase();
  if (lower === "/" || lower === "/lunar" || lower === "/lunar/")
    return "/lunar/index.NOTcfm";
  const normalized = lower.endsWith("/") ? `${lower}index.cfm` : lower;
  return normalized.replace(/\.(?:notcfm|cfm)$/, ".NOTcfm");
}

/** Only retained editorial routes and implemented application routes become local. */
export function presentationUrl(
  href: string,
  base: string,
  knownPages: Set<string>,
): string {
  if (href.startsWith("#")) return href;
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return "";
  }
  if (!["http:", "https:", "mailto:"].includes(url.protocol)) return "";
  if (url.hostname !== "curator.jsc.nasa.gov") return url.href;
  const path = canonicalPagePath(url.pathname);
  if (
    knownPages.has(path) ||
    (path.startsWith("/lunar/samplecatalog/") &&
      /(?:index|sampleinfo|photoinfo|thinsections|sample_results_list|photo_results_list)\.NOTcfm$/.test(
        path,
      )) ||
    path === "/lunar/references/index.NOTcfm"
  ) {
    return path + url.search + url.hash;
  }
  return url.href;
}
