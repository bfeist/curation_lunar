import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useData } from "../api/useData";
import { redesignUrl } from "../data/redesign";
import type {
  EditorialPage,
  PhotoDetail,
  SampleDetail,
} from "../types/content";
import { Arrow, Breadcrumb, formatNumber, Notice, RemoteImage } from "./shared";
import { PhotoCard, ReferenceCard } from "./catalog";

function Facts({
  entries,
}: {
  entries: [string, string | number | null | undefined][];
}) {
  return (
    <dl className="n-facts">
      {entries.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value == null || value === "" ? "Not recorded" : value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function SampleView() {
  const { id = "" } = useParams();
  const { data, error } = useData<SampleDetail>(
    `/api/samples/${encodeURIComponent(id)}`,
  );
  const [selected, setSelected] = useState<string>();
  const location = useLocation();
  useEffect(() => {
    if (data && location.hash)
      requestAnimationFrame(() =>
        document.getElementById(location.hash.slice(1))?.scrollIntoView(),
      );
  }, [data, location.hash]);
  if (!data)
    return (
      <div className="n-wrap n-page">
        <Breadcrumb current={`Sample ${id}`} catalog />
        <Notice error={!!error}>{error || "Loading sample record…"}</Notice>
        <Link to="/new/catalog">Return to sample catalog →</Link>
      </div>
    );
  const { sample, photos, publications, sections, locations, references } =
    data;
  const hero =
    photos.find((photo) => photo.id === selected) ||
    photos.find((photo) => photo.preview) ||
    photos[0];
  return (
    <div className="n-wrap n-page">
      <Breadcrumb current={`Sample ${id}`} catalog />
      <div className="n-detail-heading">
        <div>
          <p className="n-eyebrow">
            {sample.mission || "Lunar collection"} /{" "}
            {sample.type || "Sample record"}
          </p>
          <h1>Sample {id}</h1>
          <p>{sample.subtype || sample.description || "Lunar sample record"}</p>
        </div>
        <Link
          className="n-button"
          to={redesignUrl("/lunar/sampreq/requests.NOTcfm")}
        >
          Request samples <Arrow />
        </Link>
      </div>
      <div className="n-detail-grid">
        <div>
          <div className="n-sample-hero">
            <RemoteImage
              src={
                hero?.preview ||
                (id === "64435"
                  ? "https://curator.jsc.nasa.gov/lunar/_images/64435.jpg"
                  : null)
              }
              alt={`Sample ${id}${hero ? `, photograph ${hero.id}` : ""}`}
              eager
            />
          </div>
          {hero && (
            <p className="n-caption">
              {hero.id} · NASA / Johnson Space Center{" "}
              <Link to={`/new/photos/${encodeURIComponent(hero.id)}`}>
                Photo details <Arrow />
              </Link>
            </p>
          )}
          {photos.length > 1 && (
            <div className="n-thumbnails" aria-label="Choose sample photograph">
              {photos
                .filter((photo) => photo.preview)
                .slice(0, 8)
                .map((photo) => (
                  <button
                    key={photo.id}
                    aria-label={`Show photograph ${photo.id}`}
                    aria-pressed={hero?.id === photo.id}
                    onClick={() => setSelected(photo.id)}
                  >
                    <RemoteImage src={photo.preview} alt="" />
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="n-overview">
          <p className="n-eyebrow">Sample overview</p>
          <h2>A piece of {sample.mission || "lunar history"}.</h2>
          <Facts
            entries={[
              [
                "Classification",
                [sample.type, sample.subtype].filter(Boolean).join(" / "),
              ],
              [
                "Original mass",
                sample.weight == null
                  ? null
                  : `${formatNumber(sample.weight)} g`,
              ],
              ["Mission", sample.mission],
              ["Collection station", sample.station],
              ["Landmark", sample.landmark],
              ["Bag number", sample.bagNumber],
              [
                "Pristine material",
                sample.pristine == null
                  ? null
                  : `${formatNumber(sample.pristine)}%`,
              ],
              ["Pristinity date", sample.pristinityDate],
            ]}
          />
          {sample.sourceUrl && (
            <a className="n-text-link" href={sample.sourceUrl}>
              View NASA source record <Arrow />
            </a>
          )}
        </div>
      </div>
      <nav className="n-section-nav" aria-label="On this sample page">
        <a href="#description">Overview</a>
        <a href="#photographs">Photographs ({photos.length})</a>
        <a href="#publications">Publications</a>
        <a href="#sections">Thin sections ({sections.length})</a>
        <a href="#displays">Displays ({locations.length})</a>
        <a href="#references">References</a>
      </nav>
      <section id="description" className="n-detail-section">
        <p className="n-eyebrow">The record</p>
        <h2>About this sample</h2>
        <p>
          {sample.description ||
            "A description has not been captured for this sample. Consult the NASA source record for additional information."}
        </p>
        <p className="n-data-note">
          The local acquisition is being enriched. Missing fields, photographs,
          or related records should be checked against the NASA source before
          use in research. Allocation and availability are determined through
          the sample request process.
        </p>
      </section>
      <section id="photographs" className="n-detail-section">
        <div className="n-section-heading">
          <h2>Sample photography</h2>
          <Link
            className="n-text-link"
            to={`/new/photos?sample=${encodeURIComponent(id)}`}
          >
            View all {photos.length} photos <Arrow />
          </Link>
        </div>
        {photos.length ? (
          <div className="n-card-grid">
            {photos.slice(0, 6).map((photo) => (
              <PhotoCard photo={photo} key={photo.id} />
            ))}
          </div>
        ) : (
          <p>No associated photographs are present in this snapshot.</p>
        )}
      </section>
      <section id="publications" className="n-detail-section">
        <h2>Catalogs & publications</h2>
        {publications.length ? (
          <div className="n-publications">
            {publications.map((publication) => (
              <a href={publication.url} key={publication.id}>
                {publication.title || "Sample publication"} <Arrow />
              </a>
            ))}
          </div>
        ) : (
          <p>No associated publications are present in this snapshot.</p>
        )}
      </section>
      <section id="sections" className="n-detail-section">
        <h2>Thin sections</h2>
        {sections.length ? (
          <div
            className="n-table-scroll"
            role="region"
            aria-label="Thin section records"
            tabIndex={0}
          >
            <table>
              <caption>Captured thin section records for sample {id}</caption>
              <thead>
                <tr>
                  <th scope="col">Specific</th>
                  <th scope="col">Mass (g)</th>
                  <th scope="col">Description</th>
                  <th scope="col">Recorded availability</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <tr key={section.id}>
                    <th scope="row">
                      {id},{section.specific}
                    </th>
                    <td>{formatNumber(section.weight)}</td>
                    <td>{section.description || "Not recorded"}</td>
                    <td>{section.availability || "Not recorded"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No thin section records are present in this snapshot.</p>
        )}
      </section>
      <section id="displays" className="n-detail-section">
        <h2>On public display</h2>
        {locations.length ? (
          <div className="n-pathway-grid">
            {locations.map((place) => (
              <article className="n-location" key={place.id}>
                <h3>
                  {place.url ? (
                    <a href={place.url}>
                      {place.name || "Display location"} <Arrow />
                    </a>
                  ) : (
                    place.name || "Display location"
                  )}
                </h3>
                <p>
                  {[place.city, place.state, place.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p>{place.description || `Specific ${place.specific}`}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>No display records are present in this snapshot.</p>
        )}
      </section>
      <section id="references" className="n-detail-section">
        <div className="n-section-heading">
          <h2>Related research</h2>
          <Link
            className="n-text-link"
            to={`/new/references?sample=${encodeURIComponent(id)}`}
          >
            Browse all references <Arrow />
          </Link>
        </div>
        {references.length ? (
          references
            .slice(0, 5)
            .map((reference) => (
              <ReferenceCard key={reference.id} reference={reference} />
            ))
        ) : (
          <p>No associated references are present in this snapshot.</p>
        )}
      </section>
    </div>
  );
}
export function PhotoView() {
  const { id = "" } = useParams();
  const { data, error } = useData<PhotoDetail>(
    `/api/photos/${encodeURIComponent(id)}`,
  );
  if (!data)
    return (
      <div className="n-wrap n-page">
        <Notice error={!!error}>{error || "Loading photograph…"}</Notice>
        <Link to="/new/photos">Return to photo library →</Link>
      </div>
    );
  const { photo, assets, samples } = data;
  return (
    <div className="n-wrap n-page">
      <Breadcrumb current={`Photo ${id}`} />
      <div className="n-page-title">
        <p className="n-eyebrow">Lunar photo library</p>
        <h1>{id}</h1>
        <p>{photo.description || "Lunar sample photography"}</p>
      </div>
      <div className="n-detail-grid">
        <div>
          <div className="n-photo-full">
            <RemoteImage
              src={photo.preview}
              alt={photo.description || `Photograph ${id}`}
              eager
            />
          </div>
          <p className="n-caption">NASA / Johnson Space Center</p>
        </div>
        <div>
          <Facts
            entries={[
              ["Mission", photo.mission],
              ["Type", photo.type],
              ["Subtype", photo.subtype],
              ["Film", photo.film],
              ["Orientation", photo.orientation],
              ["Angle", photo.angle],
              ["Related specifics", photo.specifics],
            ]}
          />
          <div className="n-inline-links">
            {samples.map((sample) => (
              <Link
                to={`/new/samples/${encodeURIComponent(sample)}`}
                key={sample}
              >
                Sample {sample} →
              </Link>
            ))}
          </div>
          {photo.sourceUrl && (
            <a className="n-text-link" href={photo.sourceUrl}>
              NASA source record <Arrow />
            </a>
          )}
          <div className="n-publications">
            {assets
              .filter((asset) => asset.role === "a:href")
              .map((asset) => (
                <a key={asset.url} href={asset.url}>
                  {asset.label || "Open original asset"} <Arrow />
                </a>
              ))}
          </div>
        </div>
      </div>
      <p className="n-data-note">
        Images are served directly by NASA. Some photographic records are
        awaiting detail enrichment in this snapshot.
      </p>
    </div>
  );
}
export function ContentPage() {
  const [params] = useSearchParams();
  const path = params.get("path") || "/lunar/index.NOTcfm";
  const { data, error } = useData<EditorialPage>(
    `/api/page?path=${encodeURIComponent(path)}`,
  );
  const navigate = useNavigate();
  const location = useLocation();
  const html = useMemo(() => {
    if (!data) return "";
    // The API has already sanitized this markup. Only adapt local link targets;
    // never proxy or rewrite hosted imagery, PDFs, or other external assets.
    const doc = new DOMParser().parseFromString(data.html, "text/html");
    doc
      .querySelectorAll<HTMLAnchorElement>("a[href]")
      .forEach((anchor) =>
        anchor.setAttribute("href", redesignUrl(anchor.getAttribute("href")!)),
      );
    return doc.body.innerHTML;
  }, [data]);
  useEffect(() => {
    if (html && location.hash)
      requestAnimationFrame(() =>
        document.getElementById(location.hash.slice(1))?.scrollIntoView(),
      );
  }, [html, location.hash]);
  const source = new URL(
    path.startsWith("/") && !path.startsWith("//")
      ? path.replace(/\.NOTcfm/gi, ".cfm")
      : "/lunar/index.cfm",
    "https://curator.jsc.nasa.gov",
  ).href;
  return (
    <div className="n-wrap n-page">
      <Breadcrumb current={data?.title || "Collection resources"} />
      {data ? (
        <>
          <div className="n-page-title">
            <p className="n-eyebrow">Lunar Curation / Resources</p>
            <h1>{data.title}</h1>
          </div>
          <div className="n-content-layout">
            <article
              className="n-editorial"
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={(event) => {
                const anchor = (
                  event.target as Element
                ).closest<HTMLAnchorElement>("a[href]");
                const href = anchor?.getAttribute("href");
                if (
                  href?.startsWith("/new") &&
                  event.button === 0 &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.shiftKey &&
                  !event.altKey &&
                  !anchor?.target
                ) {
                  event.preventDefault();
                  navigate(href);
                }
              }}
            />
            <aside className="n-resource-aside">
              <p className="n-eyebrow">Explore further</p>
              <h2>Start with a sample.</h2>
              <p>
                Find sample records, photographs, and related research in one
                place.
              </p>
              <Link className="n-button" to="/new/catalog">
                Sample catalog →
              </Link>
              <a href={data.sourceUrl}>
                View original NASA page <Arrow />
              </a>
            </aside>
          </div>
        </>
      ) : (
        <>
          <h1>Collection resources</h1>
          <Notice error={!!error}>
            {error || "Loading collection resource…"}
          </Notice>
          {error && (
            <p>
              This resource is available on the live Lunar Curation website.{" "}
              <a href={source}>
                Continue to NASA <Arrow />
              </a>
            </p>
          )}
        </>
      )}
    </div>
  );
}
