import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useData } from "../api/useData";
import type { EditorialPage as Page } from "../types/content";
import { SiteLayout } from "../components/layout/SiteLayout";
import { Loading } from "../components/common";
import { nasaOrigin } from "../data/routes";
import { EditorialContent } from "../components/EditorialContent";

export function EditorialPage() {
  const { pathname } = useLocation();
  const { data, error } = useData<Page>(
    `/api/page?path=${encodeURIComponent(pathname)}`,
  );
  useEffect(() => {
    if (data) document.title = `${data.title} — Lunar Curation`;
  }, [data]);
  return (
    <SiteLayout title={data?.title ?? "Lunar Samples"}>
      {data ? (
        <EditorialContent html={data.html} />
      ) : (
        <>
          <Loading error={error} />
          {error && (
            <p>
              <a href={nasaOrigin + pathname}>
                View this page on NASA’s website
              </a>
            </p>
          )}
        </>
      )}
    </SiteLayout>
  );
}
