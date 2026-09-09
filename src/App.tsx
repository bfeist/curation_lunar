import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { EditorialPage } from "./pages/EditorialPage";
import { CatalogPage } from "./pages/CatalogPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SamplePage } from "./pages/SamplePage";
import { PhotoPage } from "./pages/PhotoPage";
import { ReferencesPage } from "./pages/ReferencesPage";
import { NewSite } from "./new/NewSite";

function RouteEffects() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname.startsWith("/new")) return;
    document.title = "Lunar Samples — Astromaterials Curation";
    if (!location.hash) window.scrollTo(0, 0);
    else
      requestAnimationFrame(() =>
        document
          .getElementById(decodeURIComponent(location.hash.slice(1)))
          ?.scrollIntoView(),
      );
  }, [location.pathname, location.search, location.hash]);
  return null;
}
export function App() {
  return (
    <BrowserRouter>
      <RouteEffects />
      <Routes>
        <Route path="/new/*" element={<NewSite />} />
        <Route
          path="/lunar/samplecatalog/index.NOTcfm"
          element={<CatalogPage />}
        />
        <Route path="/lunar/samplecatalog/" element={<CatalogPage />} />
        <Route
          path="/lunar/samplecatalog/sample_results_list.NOTcfm"
          element={<ResultsPage />}
        />
        <Route
          path="/lunar/samplecatalog/photo_results_list.NOTcfm"
          element={<ResultsPage photos />}
        />
        <Route
          path="/lunar/samplecatalog/sampleinfo.NOTcfm"
          element={<SamplePage />}
        />
        <Route
          path="/lunar/samplecatalog/thinsections.NOTcfm"
          element={<SamplePage thin />}
        />
        <Route
          path="/lunar/samplecatalog/photoinfo.NOTcfm"
          element={<PhotoPage />}
        />
        <Route
          path="/lunar/references/index.NOTcfm"
          element={<ReferencesPage />}
        />
        <Route path="*" element={<EditorialPage />} />
      </Routes>
    </BrowserRouter>
  );
}
