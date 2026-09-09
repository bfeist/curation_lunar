import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useData } from "../api/useData";
import type { Vocabulary, EditorialPage } from "../types/content";
import { EditorialContent } from "../components/EditorialContent";
import { SiteLayout } from "../components/layout/SiteLayout";
import { Loading } from "../components/common";

function Checks({
  title,
  name,
  values,
}: {
  title: string;
  name: string;
  values: string[];
}) {
  return (
    <fieldset>
      <legend>{title}</legend>
      {values.map((value) => (
        <label className="check" key={value}>
          <input type="checkbox" name={name} value={value} />
          {value}
        </label>
      ))}
    </fieldset>
  );
}
function OptionalNumber({
  label,
  name,
  suffix = "",
}: {
  label: string;
  name: string;
  suffix?: string;
}) {
  const [enabled, setEnabled] = useState(false);
  return (
    <div>
      <label className="check">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {label}
      </label>
      {enabled && (
        <label className="numeric-option">
          <span>{label}</span>
          <input
            name={name}
            type="number"
            min="0"
            step="any"
            required
            aria-label={label + " value"}
          />
          {suffix}
        </label>
      )}
    </div>
  );
}
export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab") ?? "samples";
  const tab = ["samples", "photos", "missions", "pdf"].includes(requestedTab)
    ? requestedTab
    : "samples";
  const [resetKey, setResetKey] = useState(0);
  const { data: vocab, error } = useData<Vocabulary>("/api/vocabulary");
  const navigate = useNavigate();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget))
      if (typeof value === "string" && value.trim())
        search.append(key, value.trim());
    navigate(
      `/lunar/samplecatalog/${tab === "photos" ? "photo" : "sample"}_results_list.NOTcfm?${search}`,
    );
  }
  return (
    <SiteLayout wide title="Lunar Sample and Photo Catalog">
      <h1>Lunar Sample and Photo Catalog</h1>
      <div className="catalog-panel">
        <div
          className="catalog-tabs"
          role="tablist"
          aria-label="Catalog searches"
        >
          {[
            ["samples", "Search Samples"],
            ["photos", "Search Photos"],
            ["missions", "View Samples By Mission"],
            ["pdf", "View PDF Catalogs"],
          ].map(([id, name], index, tabs) => (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-controls="catalog-tab-content"
              aria-selected={tab === id}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setParams({ tab: id! })}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  const next =
                    tabs[
                      (index +
                        (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                        tabs.length
                    ]![0]!;
                  setParams({ tab: next });
                  document.getElementById(`tab-${next}`)?.focus();
                }
              }}
            >
              {name}
            </button>
          ))}
          <span>
            Lunar Sample and PhotoCatalog{" "}
            <img
              src="https://curator.jsc.nasa.gov/_images/nasa_logo.gif"
              alt="NASA"
            />
          </span>
        </div>
        <div
          className="catalog-tab-content"
          id="catalog-tab-content"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
        >
          {!vocab ? (
            <Loading error={error} />
          ) : tab === "missions" ? (
            <>
              <h2>View Samples By Mission</h2>
              <form onSubmit={submit}>
                <fieldset className="mission-select">
                  <legend>Mission</legend>
                  <label>
                    Select a mission{" "}
                    <select name="mission" required defaultValue="">
                      <option value="" disabled>
                        Select a mission
                      </option>
                      {vocab.missions.map((mission) => (
                        <option key={mission}>{mission}</option>
                      ))}
                    </select>
                  </label>
                </fieldset>
                <button>View Samples</button>
              </form>
            </>
          ) : tab === "pdf" ? (
            <CatalogPublications />
          ) : (
            <form
              onSubmit={submit}
              key={`${tab}-${resetKey}`}
              onReset={() => setResetKey((key) => key + 1)}
            >
              <h2>Lunar {tab === "photos" ? "Photo" : "Sample"} Search</h2>
              <fieldset className="number-field">
                <legend>
                  {tab === "photos" ? "Photo / Sample Number" : "Sample Number"}
                </legend>
                <label>
                  {tab === "photos" ? "Photo Number: " : "Generic: "}
                  <input
                    name="q"
                    aria-label={tab === "photos" ? "Photo Number" : "Generic"}
                  />
                </label>
                {tab === "photos" && (
                  <label>
                    Generic: <input name="sample" />
                  </label>
                )}
              </fieldset>
              <fieldset className="advanced">
                <legend>Advanced Search Options</legend>
                <div className="filter-columns">
                  <Checks
                    title="Mission"
                    name="mission"
                    values={vocab.missions}
                  />
                  <div>
                    <Checks
                      title={
                        tab === "photos"
                          ? "Photo Type"
                          : "Sample Classification"
                      }
                      name="type"
                      values={
                        tab === "photos"
                          ? vocab.photoTypes
                          : ["Basalt", "Crustal", "Breccia", "Soil", "Core"]
                      }
                    />
                    {tab === "samples" && (
                      <fieldset>
                        <legend>Other Options:</legend>
                        <label className="check">
                          <input type="checkbox" name="display" value="1" />
                          Show Public Display Samples
                        </label>
                        <label className="check">
                          <input type="checkbox" name="thin" value="1" />
                          Show Samples with Thin Sections
                        </label>
                      </fieldset>
                    )}
                  </div>
                  <div>
                    {tab === "photos" ? (
                      <Checks
                        title="Film Type"
                        name="film"
                        values={vocab.filmTypes}
                      />
                    ) : (
                      <>
                        <fieldset>
                          <legend>Sample Weight:</legend>
                          <OptionalNumber
                            label="Minimum Weight"
                            name="minWeight"
                            suffix=" g"
                          />
                          <OptionalNumber
                            label="Maximum Weight"
                            name="maxWeight"
                            suffix=" g"
                          />
                        </fieldset>
                        <fieldset>
                          <legend>% Pristine Sample Available:</legend>
                          <OptionalNumber
                            label="Minimum % Pristine from Original Weight"
                            name="pristine"
                            suffix=" %"
                          />
                        </fieldset>
                      </>
                    )}
                  </div>
                </div>
              </fieldset>
              <details className="additional-filters">
                <summary>More search options</summary>
                <div className="select-filters">
                  {(tab === "samples"
                    ? [
                        ["Subtype", "subtype", vocab.subtypes],
                        ["Station", "station", vocab.stations],
                        ["Landmark", "landmark", vocab.landmarks],
                      ]
                    : [["Photo Subtype", "subtype", vocab.photoSubtypes]]
                  ).map(([label, name, values]) => (
                    <label key={name as string}>
                      {label}
                      <select name={name as string}>
                        <option value="">All</option>
                        {(values as string[]).map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </details>
              <div className="form-actions">
                <button type="submit">Search</button>
                <button type="reset">Reset</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}

function CatalogPublications() {
  const { data, error } = useData<EditorialPage>("/api/catalog-pdfs");
  return data ? (
    <EditorialContent html={data.html} />
  ) : (
    <Loading error={error} />
  );
}
