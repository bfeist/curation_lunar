import { useSearchParams } from "react-router-dom";
import { useData } from "../api/useData";
import type { Reference, Results } from "../types/content";
import { SiteLayout } from "../components/layout/SiteLayout";
import { Loading, Pagination } from "../components/common";
import { ReferenceList } from "./SamplePage";

export function ReferencesPage() {
  const [params, setParams] = useSearchParams();
  const { data, error } = useData<Results<Reference>>(
    `/api/references?${params}`,
  );
  return (
    <SiteLayout title="Lunar Reference Search">
      <h1>Lunar Reference Search</h1>
      <form
        className="reference-form"
        onSubmit={(event) => {
          event.preventDefault();
          const query = new URLSearchParams();
          for (const [key, value] of new FormData(event.currentTarget))
            if (typeof value === "string" && value) query.set(key, value);
          query.set("search", "1");
          setParams(query);
        }}
      >
        {[
          ["Sample Number", "sample"],
          ["Author", "author"],
          ["Title", "title"],
          ["Keyword", "q"],
        ].map(([label, name]) => (
          <label key={name}>
            {label}
            <input
              name={name}
              defaultValue={params.get(name!) ?? ""}
              key={`${name}-${params.get(name!)}`}
            />
          </label>
        ))}
        <button>Search</button>
      </form>
      {params.has("search") &&
        (!data ? (
          <Loading error={error} />
        ) : (
          <>
            <p role="status">{data.total} references found in this snapshot.</p>
            <ReferenceList references={data.items} />
            <Pagination
              total={data.total}
              page={data.page}
              pageSize={data.pageSize}
              onPage={(page) => {
                const next = new URLSearchParams(params);
                next.set("page", String(page));
                setParams(next);
              }}
            />
          </>
        ))}
    </SiteLayout>
  );
}
