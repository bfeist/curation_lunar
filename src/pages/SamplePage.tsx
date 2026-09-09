import { Link, useSearchParams } from "react-router-dom";
import type { SampleDetail, Reference } from "../types/content";
import { useData } from "../api/useData";
import { SiteLayout } from "../components/layout/SiteLayout";
import {
  CatalogBrand,
  Loading,
  SectionRow,
  DataRow,
} from "../components/common";
import { PhotoGallery } from "../components/PhotoGallery";
import { samplePath } from "../data/routes";

export function ReferenceList({ references }: { references: Reference[] }) {
  return (
    <ol className="reference-list">
      {references.map((reference) => (
        <li key={reference.id}>
          <p>{reference.citation || reference.title}</p>
          {reference.links.map((link, i) => (
            <a key={link} href={link}>
              Publication {i + 1} ↗{" "}
            </a>
          ))}
          {reference.samples.length > 0 && (
            <details>
              <summary>Associated samples ({reference.samples.length})</summary>
              <div className="sample-links">
                {reference.samples.map((id) => (
                  <Link key={id} to={samplePath(id)}>
                    {id}
                  </Link>
                ))}
              </div>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}
export function SamplePage({ thin = false }: { thin?: boolean }) {
  const [params] = useSearchParams();
  const id = params.get("sample") ?? "";
  const { data, error } = useData<SampleDetail>(
    `/api/samples/${encodeURIComponent(id)}`,
  );
  const title = thin ? `Thin Sections for Sample ${id}` : `Apollo Sample ${id}`;
  const sample = data?.sample;
  return (
    <SiteLayout wide title={title}>
      <CatalogBrand />
      <article className="detail-panel">
        <h1>{title}</h1>
        {!data || !sample ? (
          <Loading error={error} />
        ) : thin ? (
          <>
            <p>
              <Link to={samplePath(id)}>Back to sample {id}</Link>
            </p>
            <ThinSections data={data} />
          </>
        ) : (
          <>
            <table className="data-table sample-table">
              <tbody>
                <SectionRow> </SectionRow>
                <DataRow label="Generic Number">{sample.id}</DataRow>
                <SectionRow>Mission Information</SectionRow>
                <DataRow label="Mission">{sample.mission}</DataRow>
                <DataRow label="Station">{sample.station}</DataRow>
                <DataRow label="Landmark">{sample.landmark}</DataRow>
                <DataRow label="Bag Number">{sample.bagNumber}</DataRow>
                <DataRow label="Original Weight">
                  {sample.weight !== null ? `${sample.weight} g` : null}
                </DataRow>
                <SectionRow>Sample Classification</SectionRow>
                <DataRow label="Rock Type">{sample.type}</DataRow>
                <DataRow label="Rock Subtype">{sample.subtype}</DataRow>
                <DataRow label="Description">{sample.description}</DataRow>
                <SectionRow>Sample Availability</SectionRow>
                <DataRow label="Percent of Pristine Sample Available">
                  {sample.pristine !== null ? `${sample.pristine}%` : null}
                </DataRow>
                <DataRow label="Date of Pristinity Calculation">
                  {sample.pristinityDate
                    ? new Date(
                        `${sample.pristinityDate}T12:00:00Z`,
                      ).toLocaleDateString("en-US", {
                        timeZone: "UTC",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null}
                </DataRow>
                <DataRow label="Thin Sections Available">
                  {sample.thinSections || data.sections.length ? (
                    <Link
                      to={`/lunar/samplecatalog/thinsections.NOTcfm?sample=${id}`}
                    >
                      See list of available thin sections.
                    </Link>
                  ) : null}
                </DataRow>
                <SectionRow>Public Displays</SectionRow>
                <DataRow label="Display Samples Available">
                  {data.locations.map((location) => (
                    <div key={location.id}>
                      <strong>
                        {id},{location.specific}
                      </strong>{" "}
                      —{" "}
                      {location.url ? (
                        <a href={location.url}>{location.name}</a>
                      ) : (
                        location.name
                      )}
                      <br />
                      {[location.city, location.state, location.country]
                        .filter(Boolean)
                        .join(", ")}
                      {location.description && <p>{location.description}</p>}
                    </div>
                  ))}
                  {sample.displays && !data.locations.length
                    ? "Display details have not yet been acquired."
                    : null}
                </DataRow>
                <SectionRow>Catalogs and Publications</SectionRow>
                <tr>
                  <td colSpan={2}>
                    {data.publications.length ? (
                      <ul className="publication-list">
                        {data.publications.map((p) => (
                          <li key={p.id}>
                            <a href={p.url}>{p.title}</a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "No publication links in this snapshot."
                    )}
                  </td>
                </tr>
                <SectionRow>Images for Apollo Sample {id}</SectionRow>
                <tr>
                  <td colSpan={2}>
                    {data.photos.length ? (
                      <PhotoGallery key={id} photos={data.photos} />
                    ) : (
                      <p>
                        No photos are recorded for this sample in the current
                        snapshot.
                      </p>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
            {data.references.length > 0 && (
              <section>
                <h2>References</h2>
                <ReferenceList references={data.references} />
                <Link
                  to={`/lunar/references/index.NOTcfm?sample=${id}&search=1`}
                >
                  Search all references for {id}
                </Link>
              </section>
            )}
            {!sample.status.includes("html") && (
              <p className="notice">
                This sample’s inventory record is available. Detailed page
                enrichment is still pending in this snapshot.
              </p>
            )}
            {sample.sourceUrl && (
              <p className="source-link">
                <a href={sample.sourceUrl}>
                  View original sample record on NASA’s website ↗
                </a>
              </p>
            )}
          </>
        )}
      </article>
    </SiteLayout>
  );
}
function ThinSections({ data }: { data: SampleDetail }) {
  return data.sections.length ? (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {[
              "Sample",
              "Specific",
              "Weight (g)",
              "Description",
              "Availability",
            ].map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.sections.map((section) => (
            <tr key={section.id}>
              <td>{data.sample.id}</td>
              <td>{section.specific}</td>
              <td>{section.weight}</td>
              <td>{section.description}</td>
              <td>{section.availability}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p>
      No thin-section details have been acquired for this sample in the current
      snapshot.
    </p>
  );
}
