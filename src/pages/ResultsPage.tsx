import { Link, useSearchParams } from "react-router-dom";
import type { Sample, Photo, Results } from "../types/content";
import { useData } from "../api/useData";
import { SiteLayout } from "../components/layout/SiteLayout";
import { Loading, Pagination } from "../components/common";
import { PhotoCards } from "../components/PhotoGallery";
import { catalogPath, samplePath } from "../data/routes";

export function ResultsPage({ photos = false }: { photos?: boolean }) {
  const [params, setParams] = useSearchParams();
  const { data, error } = useData<Results<Sample> | Results<Photo>>(
    `/api/${photos ? "photos" : "samples"}?${params}`,
  );
  const title = `Lunar ${photos ? "Photo" : "Samples"} Search Results`;
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next);
  }
  return (
    <SiteLayout wide title={title}>
      <h1>{title}</h1>
      <div className="results-panel">
        <p>
          <Link to={`${catalogPath}?tab=${photos ? "photos" : "samples"}`}>
            New search
          </Link>
        </p>
        <form
          className="refine-search"
          onSubmit={(e) => {
            e.preventDefault();
            update("q", new FormData(e.currentTarget).get("q") as string);
          }}
        >
          <label>
            Search within these filters{" "}
            <input
              name="q"
              defaultValue={params.get("q") ?? ""}
              key={params.get("q")}
            />
          </label>
          <button>Search</button>
        </form>
        <div className="active-filters">
          {[...params]
            .filter(
              ([key, value]) =>
                value && !["page", "sort", "pageSize", "q"].includes(key),
            )
            .map(([key, value], i) => (
              <span key={`${key}-${i}`}>
                {key}: {value}{" "}
                <button
                  aria-label={`Remove ${key} ${value}`}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.delete(key, value);
                    next.delete("page");
                    setParams(next);
                  }}
                >
                  ×
                </button>
              </span>
            ))}
        </div>
        {!data ? (
          <Loading error={error} />
        ) : (
          <>
            <div className="results-tools">
              <p role="status">
                {data.total.toLocaleString()} {photos ? "photos" : "samples"}{" "}
                found
              </p>
              <label>
                Per page{" "}
                <select
                  value={data.pageSize}
                  onChange={(e) => update("pageSize", e.target.value)}
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              {!photos && (
                <label>
                  Sort by{" "}
                  <select
                    value={params.get("sort") ?? "id"}
                    onChange={(e) => update("sort", e.target.value)}
                  >
                    <option value="id">Sample number</option>
                    <option value="mission">Mission</option>
                    <option value="weight">Weight</option>
                    <option value="type">Classification</option>
                  </select>
                </label>
              )}
            </div>
            {data.total === 0 ? (
              <p>
                No matching records. Change or remove filters to search again.
              </p>
            ) : photos ? (
              <PhotoCards photos={data.items as Photo[]} />
            ) : (
              <div className="table-scroll">
                <table className="data-table result-table">
                  <thead>
                    <tr>
                      {[
                        "Sample Number",
                        "Mission",
                        "Station",
                        "Rock Type",
                        "Rock Subtype",
                        "Original Weight (g)",
                        "% Pristine",
                      ].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data.items as Sample[]).map((sample) => (
                      <tr key={sample.id}>
                        <td>
                          <Link to={samplePath(sample.id)}>{sample.id}</Link>
                        </td>
                        <td>{sample.mission}</td>
                        <td>{sample.station}</td>
                        <td>{sample.type}</td>
                        <td>{sample.subtype}</td>
                        <td>{sample.weight}</td>
                        <td>{sample.pristine}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              total={data.total}
              page={data.page}
              pageSize={data.pageSize}
              onPage={(page) => update("page", String(page))}
            />
          </>
        )}
      </div>
    </SiteLayout>
  );
}
