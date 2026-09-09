/** Keep captured local content inside the redesign; assets stay at their origin. */
export function redesignUrl(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/new"))
    return href;
  const url = new URL(href, "https://curator.jsc.nasa.gov");
  const path = url.pathname.toLowerCase();
  if (!path.endsWith(".notcfm") && !path.endsWith("/")) return href;
  if (path.includes("sampleinfo.") || path.includes("thinsections.")) {
    const id = url.searchParams.get("sample");
    if (id)
      return `/new/samples/${encodeURIComponent(id)}${path.includes("thinsections.") ? "#sections" : url.hash}`;
  }
  if (path.includes("photoinfo.")) {
    const id = url.searchParams.get("photo");
    if (id) return `/new/photos/${encodeURIComponent(id)}`;
  }
  if (path.includes("sample_results_list.")) return `/new/catalog${url.search}`;
  if (path.includes("photo_results_list.")) return `/new/photos${url.search}`;
  if (path.includes("/samplecatalog/")) return "/new/catalog";
  if (path.includes("/references/")) return `/new/references${url.search}`;
  return `/new/page?path=${encodeURIComponent(url.pathname + url.search)}${url.hash}`;
}

export function catalogQuery(params: URLSearchParams): string {
  const next = new URLSearchParams(params);
  next.delete("page");
  next.delete("pageSize");
  next.sort();
  return next.toString();
}
