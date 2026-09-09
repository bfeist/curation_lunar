import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useData } from "../api/useData";
import { catalogQuery } from "../data/redesign";
import type { Photo, Reference, Sample, Vocabulary } from "../types/content";
import {
  Arrow,
  Breadcrumb,
  formatNumber,
  Notice,
  RemoteImage,
  ResultStream,
  SearchBox,
} from "./shared";

export function SampleCard({ sample }: { sample: Sample }) {
  return (
    <Link
      className="n-sample-card"
      to={`/new/samples/${encodeURIComponent(sample.id)}`}
    >
      <div className="n-card-image">
        <RemoteImage src={sample.preview} alt={`Lunar sample ${sample.id}`} />
        <span className="n-image-tag">
          {sample.mission ?? "Lunar collection"}
        </span>
      </div>
      <div className="n-card-body">
        <p className="n-eyebrow">{sample.type ?? "Lunar sample"}</p>
        <h3>
          {sample.id} <Arrow />
        </h3>
        <p className="n-card-description">
          {sample.subtype ||
            sample.description ||
            "Explore sample details and related records."}
        </p>
        <div className="n-card-facts">
          <span>
            {sample.weight == null
              ? "Mass not recorded"
              : `${formatNumber(sample.weight)} g`}
          </span>
          <span>
            {sample.thinSections === 1
              ? "Thin sections"
              : sample.station
                ? `Station ${sample.station}`
                : "Sample record"}
          </span>
        </div>
      </div>
    </Link>
  );
}
export function PhotoCard({ photo }: { photo: Photo }) {
  return (
    <Link
      className="n-sample-card"
      to={`/new/photos/${encodeURIComponent(photo.id)}`}
    >
      <div className="n-card-image">
        <RemoteImage
          src={photo.preview}
          alt={photo.description || `Photograph ${photo.id}`}
        />
      </div>
      <div className="n-card-body">
        <p className="n-eyebrow">{photo.mission || "Lunar photography"}</p>
        <h3>
          {photo.id} <Arrow />
        </h3>
        <p className="n-card-description">
          {[photo.type, photo.subtype].filter(Boolean).join(" · ") ||
            photo.description ||
            "Photographic record"}
        </p>
      </div>
    </Link>
  );
}
export function ReferenceCard({ reference }: { reference: Reference }) {
  return (
    <article className="n-reference">
      <p className="n-eyebrow">{reference.year || "Year not recorded"}</p>
      <h3>{reference.title || "Scientific reference"}</h3>
      <p>
        {reference.citation || reference.authors || "Citation not recorded"}
      </p>
      <div className="n-inline-links">
        {reference.links.map((link, i) => (
          <a href={link} key={link}>
            Publication{reference.links.length > 1 ? ` ${i + 1}` : ""} <Arrow />
          </a>
        ))}
        {reference.samples.map((sample) => (
          <Link key={sample} to={`/new/samples/${encodeURIComponent(sample)}`}>
            Sample {sample}
          </Link>
        ))}
      </div>
    </article>
  );
}
function useFilters() {
  const [params, setParams] = useSearchParams();
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    next.delete("pageSize");
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "mission") {
      next.delete("station");
      next.delete("landmark");
    }
    setParams(next);
  };
  return {
    params,
    change,
    setParams,
    clear: () => setParams({}),
    query: catalogQuery(params),
  };
}
function SelectFilter({
  name,
  label,
  values,
  value,
  change,
}: {
  name: string;
  label: string;
  values: string[];
  value: string;
  change: (key: string, value: string) => void;
}) {
  return (
    <label className="n-field">
      <span>{label}</span>
      <select
        disabled={values.length === 0}
        value={value}
        onChange={(e) => change(name, e.target.value)}
      >
        <option value="">
          {values.length ? `All ${label.toLowerCase()}` : "Not yet available"}
        </option>
        {values.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
export function Catalog() {
  const [filtersInitiallyOpen] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia("(max-width: 760px)").matches,
  );
  const { params, change, setParams, clear, query } = useFilters();
  const { data: vocabulary, error } = useData<Vocabulary>(
    `/api/vocabulary?mission=${encodeURIComponent(params.getAll("mission").length === 1 ? params.get("mission")! : "")}`,
  );
  const filters = [...params].filter(
    ([key, value]) => value && !["sort", "page", "pageSize"].includes(key),
  );
  return (
    <div className="n-wrap n-page">
      <Breadcrumb current="Sample catalog" />
      <div className="n-page-title">
        <p className="n-eyebrow">Explore the collection</p>
        <h1>Lunar sample catalog</h1>
        <p>
          Find the material behind the discovery. Search lunar samples by
          mission, classification, and physical properties.
        </p>
      </div>
      <SearchBox
        initial={params.get("q") || ""}
        onSearch={(q) => change("q", q)}
      />
      <div className="n-catalog-layout">
        <aside className="n-filters" aria-label="Sample filters">
          <details open={filtersInitiallyOpen}>
            <summary>
              Filter samples <span aria-hidden="true">⌄</span>
            </summary>
            {error && (
              <Notice error>
                Filters are temporarily unavailable. You can still search above.
              </Notice>
            )}
            <fieldset>
              <legend>Mission</legend>
              {(
                vocabulary?.missions ?? [
                  "Apollo 11",
                  "Apollo 12",
                  "Apollo 14",
                  "Apollo 15",
                  "Apollo 16",
                  "Apollo 17",
                ]
              ).map((mission) => (
                <label className="n-check" key={mission}>
                  <input
                    type="checkbox"
                    checked={params.getAll("mission").includes(mission)}
                    onChange={(event) => {
                      const next = new URLSearchParams(params);
                      const selected = next
                        .getAll("mission")
                        .filter((m) => m !== mission);
                      if (event.target.checked) selected.push(mission);
                      next.delete("mission");
                      selected.forEach((m) => next.append("mission", m));
                      next.delete("station");
                      next.delete("landmark");
                      next.delete("page");
                      // Multi-select remains shareable in the URL.
                      changeMissions(next);
                    }}
                  />
                  {mission}
                </label>
              ))}
            </fieldset>
            <SelectFilter
              name="type"
              label="Sample types"
              values={vocabulary?.types ?? []}
              value={params.get("type") || ""}
              change={change}
            />
            <SelectFilter
              name="subtype"
              label="Subtypes"
              values={vocabulary?.subtypes ?? []}
              value={params.get("subtype") || ""}
              change={change}
            />
            <fieldset>
              <legend>Available records</legend>
              <label className="n-check">
                <input
                  type="checkbox"
                  checked={params.get("thin") === "1"}
                  onChange={(e) => change("thin", e.target.checked ? "1" : "")}
                />
                Thin sections
              </label>
              <label className="n-check">
                <input
                  type="checkbox"
                  checked={params.get("display") === "1"}
                  onChange={(e) =>
                    change("display", e.target.checked ? "1" : "")
                  }
                />
                Public displays
              </label>
            </fieldset>
            <details className="n-advanced">
              <summary>More filters</summary>
              <SelectFilter
                name="station"
                label="Stations"
                values={vocabulary?.stations ?? []}
                value={params.get("station") || ""}
                change={change}
              />
              <SelectFilter
                name="landmark"
                label="Landmarks"
                values={vocabulary?.landmarks ?? []}
                value={params.get("landmark") || ""}
                change={change}
              />
              <form
                key={query}
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const next = new URLSearchParams(params);
                  for (const key of ["minWeight", "maxWeight", "pristine"]) {
                    const value = String(form.get(key) || "");
                    if (value) next.set(key, value);
                    else next.delete(key);
                  }
                  next.delete("page");
                  changeMissions(next);
                }}
              >
                <label className="n-field">
                  Minimum mass (g)
                  <input
                    name="minWeight"
                    type="number"
                    min="0"
                    step="any"
                    defaultValue={params.get("minWeight") || ""}
                  />
                </label>
                <label className="n-field">
                  Maximum mass (g)
                  <input
                    name="maxWeight"
                    type="number"
                    min="0"
                    step="any"
                    defaultValue={params.get("maxWeight") || ""}
                  />
                </label>
                <label className="n-field">
                  Minimum pristine (%)
                  <input
                    name="pristine"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    defaultValue={params.get("pristine") || ""}
                  />
                </label>
                <button className="n-button n-outline" type="submit">
                  Apply properties
                </button>
              </form>
            </details>
          </details>
        </aside>
        <section className="n-catalog-results" aria-label="Sample results">
          <div className="n-result-toolbar">
            <div className="n-active-filters">
              {filters.length === 0 ? (
                <span>All lunar samples</span>
              ) : (
                <>
                  <button className="n-clear" onClick={clear}>
                    Clear all
                  </button>
                  {filters.map(([key, value]) => (
                    <button
                      key={`${key}-${value}`}
                      aria-label={`Remove ${key}: ${value}`}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.delete(key, value);
                        changeMissions(next);
                      }}
                    >
                      {key === "thin"
                        ? "Thin sections"
                        : key === "display"
                          ? "Public displays"
                          : ["q", "mission", "type", "subtype"].includes(key)
                            ? value
                            : `${key}: ${value}`}{" "}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </>
              )}
            </div>
            <label className="n-sort">
              Sort by
              <select
                value={params.get("sort") || "id"}
                onChange={(e) => change("sort", e.target.value)}
              >
                <option value="id">Sample number</option>
                <option value="mission">Mission</option>
                <option value="type">Sample type</option>
                <option value="weight">Mass: low to high</option>
              </select>
            </label>
          </div>
          <ResultStream<Sample>
            key={query}
            endpoint="/api/samples"
            query={query}
            noun="samples"
            render={(sample) => <SampleCard sample={sample} />}
          />
        </section>
      </div>
      <p className="n-data-note">
        This catalog uses the current acquisition snapshot. Missing images or
        details do not imply that NASA has no record. Sample pages link to the
        live source.
      </p>
    </div>
  );
  function changeMissions(next: URLSearchParams) {
    next.delete("page");
    next.delete("pageSize");
    setParams(next);
  }
}

export function PhotoCatalog() {
  const { params, change, clear, query } = useFilters();
  const { data } = useData<Vocabulary>("/api/vocabulary");
  return (
    <div className="n-wrap n-page">
      <Breadcrumb current="Photo library" />
      <div className="n-page-title">
        <p className="n-eyebrow">A closer look</p>
        <h1>Lunar photo library</h1>
        <p>Explore sample photography from the collection.</p>
      </div>
      <SearchBox
        initial={params.get("q") || ""}
        onSearch={(q) => change("q", q)}
        label="Search photographs"
        placeholder="Photo number or description"
      />
      <div className="n-inline-filters">
        <SelectFilter
          name="mission"
          label="Missions"
          values={data?.photoMissions ?? []}
          value={params.get("mission") || ""}
          change={change}
        />
        <SelectFilter
          name="type"
          label="Photo types"
          values={data?.photoTypes ?? []}
          value={params.get("type") || ""}
          change={change}
        />
        <SelectFilter
          name="film"
          label="Film types"
          values={data?.filmTypes ?? []}
          value={params.get("film") || ""}
          change={change}
        />
        <button className="n-clear" onClick={clear}>
          Clear filters
        </button>
      </div>
      {params.get("sample") && (
        <p>
          Photographs associated with{" "}
          <Link
            to={`/new/samples/${encodeURIComponent(params.get("sample")!)}`}
          >
            sample {params.get("sample")}
          </Link>
          .
        </p>
      )}
      {data && !data.photoTypes.length && (
        <p className="n-data-note">
          Photo descriptions and classification filters are awaiting enrichment.
          Search by photo number, or browse photographs from an individual
          sample.
        </p>
      )}
      <ResultStream<Photo>
        key={query}
        endpoint="/api/photos"
        query={query}
        noun="photographs"
        render={(photo) => <PhotoCard photo={photo} />}
      />
    </div>
  );
}
export function References() {
  const { params, change, clear, query } = useFilters();
  return (
    <div className="n-wrap n-page">
      <Breadcrumb current="Scientific references" />
      <div className="n-page-title">
        <p className="n-eyebrow">Built on discovery</p>
        <h1>Scientific references</h1>
        <p>Find the published research connected to lunar samples.</p>
      </div>
      <SearchBox
        initial={params.get("q") || ""}
        onSearch={(q) => change("q", q)}
        label="Search scientific references"
        placeholder="Search citations"
      />
      <div className="n-inline-filters">
        <label className="n-field">
          Sample number
          <input
            key={params.get("sample")}
            defaultValue={params.get("sample") || ""}
            onBlur={(e) => change("sample", e.target.value.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                change("sample", e.currentTarget.value.trim());
            }}
            placeholder="e.g. 64435"
          />
        </label>
        <button className="n-clear" onClick={clear}>
          Clear filters
        </button>
      </div>
      <ResultStream<Reference>
        key={query}
        endpoint="/api/references"
        query={query}
        noun="references"
        className="n-reference-list"
        render={(reference) => <ReferenceCard reference={reference} />}
      />
    </div>
  );
}
