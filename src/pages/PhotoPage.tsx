import { Link, useSearchParams } from "react-router-dom";
import { useData } from "../api/useData";
import type { PhotoDetail } from "../types/content";
import { SiteLayout } from "../components/layout/SiteLayout";
import { Loading, DataRow, SectionRow } from "../components/common";
import { PhotoImage } from "../components/PhotoGallery";
import { samplePath } from "../data/routes";

export function PhotoPage() {
  const [params] = useSearchParams();
  const id = params.get("photo") ?? "";
  const { data, error } = useData<PhotoDetail>(
    `/api/photos/${encodeURIComponent(id)}`,
  );
  return (
    <SiteLayout wide title={`Apollo Photo ${id}`}>
      <div className="photo-return">
        <Link to="/lunar/samplecatalog/photo_results_list.NOTcfm">
          Return to Search Results
        </Link>
      </div>
      <article className="photo-panel">
        <h1>Apollo Photo {id}</h1>
        {!data ? (
          <Loading error={error} />
        ) : (
          <>
            <table className="data-table sample-table">
              <thead>
                <tr>
                  <th>Photo Number</th>
                  <th>{id}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={2}>
                    <figure className="photo-detail">
                      <PhotoImage key={id} photo={data.photo} />
                    </figure>
                  </td>
                </tr>
                <SectionRow>Related Sample Information</SectionRow>
                <DataRow label="Generic Number">
                  <div className="sample-links">
                    {data.samples.map((sample) => (
                      <Link to={samplePath(sample)} key={sample}>
                        {sample}
                      </Link>
                    ))}
                  </div>
                </DataRow>
                <DataRow label="Related Specifics">
                  {data.photo.specifics}
                </DataRow>
                <SectionRow>Photo Information</SectionRow>
                {[
                  ["Mission", data.photo.mission],
                  ["Photo Type", data.photo.type],
                  ["Photo Subtype", data.photo.subtype],
                  ["Film Type", data.photo.film],
                  ["Photo Description", data.photo.description],
                  ["Orientation", data.photo.orientation],
                  ["Angle", data.photo.angle],
                ].map(([label, value]) => (
                  <DataRow key={label} label={label!}>
                    {value}
                  </DataRow>
                ))}
                <SectionRow>High Resolution Photos</SectionRow>
                <tr>
                  <td colSpan={2}>
                    <ul className="download-links">
                      {data.assets
                        .filter((asset) => asset.role === "a:href")
                        .map((asset) => (
                          <li key={asset.url}>
                            <a href={asset.url}>
                              {asset.label || "Download photo"}
                            </a>
                          </li>
                        ))}
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
            {data.photo.status === "stub" && (
              <p className="notice">
                Detailed metadata for this photo has not yet been acquired.
              </p>
            )}
            {data.photo.sourceUrl && (
              <p>
                <a href={data.photo.sourceUrl}>
                  View original photo record on NASA’s website ↗
                </a>
              </p>
            )}
          </>
        )}
      </article>
    </SiteLayout>
  );
}
