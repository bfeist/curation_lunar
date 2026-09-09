import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { collections } from "../data/navigation";
import { Header } from "./Header";
import { nasaInsignia } from "./assets";
import { redesignUrl } from "../data/redesign";
import { useData } from "../api/useData";
import type { DatasetInfo } from "../types/content";
import { Arrow, SearchBox, formatNumber } from "./shared";
import { Catalog, PhotoCatalog, References } from "./catalog";
import { SampleView, PhotoView, ContentPage } from "./detail";
import "./new.css";

function NasaCircleArrow() {
  return (
    <svg viewBox="0 0 32 32" fill="none" focusable="false">
      <circle cx="16" cy="16" r="16" />
      <path d="M8 16.956h12.604l-3.844 4.106 1.252 1.338L24 16l-5.988-6.4-1.252 1.338 3.844 4.106H8v1.912z" />
    </svg>
  );
}

function Footer() {
  return (
    <footer className="n-footer">
      <div className="n-wrap">
        <div className="n-footer-top">
          <div>
            <a href="https://www.nasa.gov/" aria-label="NASA home">
              <img src={nasaInsignia} alt="NASA" width="72" height="61" />
            </a>
            <h2>
              Apollo’s legacy.
              <br />
              Tomorrow’s discoveries.
            </h2>
            <p>
              Preserving the lunar collection.
              <br />
              Enabling the next generation of exploration.
            </p>
          </div>
          <div>
            <h3>Explore lunar science</h3>
            <Link to="/new/catalog">Sample catalog</Link>
            <Link to="/new/photos">Photo library</Link>
            <Link to="/new/references">Scientific references</Link>
            <Link to={redesignUrl("/lunar/sampreq/requests.NOTcfm")}>
              Request a sample <Arrow />
            </Link>
          </div>
          <div>
            <h3>Astromaterials collections</h3>
            {collections
              .filter(([name]) => name !== "Lunar")
              .map(([name, href]) => (
                <a key={name} href={href}>
                  {name} <span aria-hidden="true">↗</span>
                </a>
              ))}
          </div>
        </div>
        <div className="n-footer-bottom">
          <a href="https://www.nasa.gov/about/contact-us/">Contact NASA</a>
          <a href="https://www.nasa.gov/accessibility/">Accessibility</a>
          <a href="https://www.nasa.gov/privacy/">Privacy</a>
          <Link to="/lunar/index.NOTcfm">Original prototype</Link>
          <span>Lunar Curation · Design preview</span>
        </div>
      </div>
    </footer>
  );
}
function Home() {
  const { data } = useData<DatasetInfo>("/api/dataset");
  return (
    <>
      <section className="n-hero">
        <img
          className="n-hero-photo"
          src="https://live.staticflickr.com/7320/9672172187_20cae06251_o.jpg"
          alt="An astronaut among rocks on the lunar surface, with mountains across the horizon"
          width="9000"
          height="1066"
          fetchPriority="high"
          decoding="async"
        />
        <div className="n-wrap n-hero-content">
          <p className="n-eyebrow">The lunar sample collection</p>
          <h1>
            Small samples.
            <br />
            Giant discoveries.
          </h1>
          <p className="n-hero-description">
            A new perspective on our nearest neighbor.
            <br />
            Explore the rocks and soils that bring the Moon to Earth.
          </p>
          <Link className="n-hero-link" to="/new/catalog">
            Explore the sample catalog{" "}
            <span className="n-circle" aria-hidden="true">
              <NasaCircleArrow />
            </span>
          </Link>
          <span className="n-image-credit">
            <a href="https://www.flickr.com/photos/nasa2explore/9672172187/">
              Lunar panorama · NASA Johnson
            </a>{" "}
            · Cropped ·{" "}
            <a href="https://creativecommons.org/licenses/by-nc/2.0/">
              CC BY-NC 2.0
            </a>
          </span>
        </div>
      </section>
      <section className="n-catalog-intro n-wrap">
        <div className="n-section-heading">
          <div>
            <p className="n-eyebrow">Your next discovery starts here</p>
            <h2>Find a lunar sample.</h2>
          </div>
          <Link className="n-text-link" to="/new/catalog">
            Browse all samples <Arrow />
          </Link>
        </div>
        <SearchBox />
        <div className="n-popular">
          <span>Explore by mission</span>
          {[11, 12, 14, 15, 16, 17].map((mission) => (
            <Link key={mission} to={`/new/catalog?mission=Apollo+${mission}`}>
              Apollo {mission} <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
        <div className="n-stats">
          <div>
            <strong>{data ? formatNumber(data.samples) : "—"}</strong>
            <span>Cataloged samples</span>
          </div>
          <div>
            <strong>{data ? formatNumber(data.photos) : "—"}</strong>
            <span>Photographic records</span>
          </div>
          <div>
            <strong>6</strong>
            <span>Apollo landing missions</span>
          </div>
          <p>
            From collection site to laboratory.
            <br />
            Search sample records, photography,
            <br />
            and the research they make possible.
          </p>
        </div>
      </section>
      <section className="n-feature">
        <div className="n-wrap n-feature-grid">
          <div className="n-feature-image">
            <img
              src="https://curator.jsc.nasa.gov/lunar/_images/64435.jpg"
              alt="Lunar sample 64435"
              loading="lazy"
            />
            <span>From the collection / Sample 64435</span>
          </div>
          <div className="n-feature-copy">
            <p className="n-eyebrow">More than a Moon rock</p>
            <h2>
              Every sample
              <br />
              has a story.
            </h2>
            <p>
              Apollo samples preserve a record of the Moon’s history. Follow a
              sample from its mission and collection site to its photographs,
              subsamples, and scientific literature.
            </p>
            <Link className="n-text-link" to="/new/samples/64435">
              Explore sample 64435{" "}
              <span className="n-circle" aria-hidden="true">
                <NasaCircleArrow />
              </span>
            </Link>
          </div>
        </div>
      </section>
      <section className="n-wrap n-pathways">
        <div className="n-section-heading">
          <div>
            <p className="n-eyebrow">An enduring scientific resource</p>
            <h2>Continue your exploration.</h2>
          </div>
        </div>
        <div className="n-pathway-grid">
          {[
            {
              number: "01",
              title: "Study the collection",
              text: "Sample catalogs, lunar cores, and the Lunar Sample Compendium.",
              href: "/lunar/lsc/index.NOTcfm",
            },
            {
              number: "02",
              title: "Research with us",
              text: "Learn how to request lunar samples for scientific investigation.",
              href: "/lunar/sampreq/requests.NOTcfm",
            },
            {
              number: "03",
              title: "Inside lunar curation",
              text: "Discover the facilities and care behind this irreplaceable collection.",
              href: "/lunar/lun-fac.NOTcfm",
            },
          ].map((item) => (
            <Link key={item.number} to={redesignUrl(item.href)}>
              <span className="n-eyebrow">{item.number} / Explore</span>
              <h3>
                {item.title} <Arrow />
              </h3>
              <p>{item.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
export function NewSite() {
  const location = useLocation();
  useEffect(() => {
    document.title = "Lunar Curation | NASA — Design preview";
    if (!location.hash) window.scrollTo(0, 0);
    else
      requestAnimationFrame(() =>
        document.getElementById(location.hash.slice(1))?.scrollIntoView(),
      );
  }, [location.pathname, location.hash]);
  return (
    <div className="new-site">
      <a className="n-skip" href="#n-main">
        Skip to main content
      </a>
      <Header />
      <main id="n-main" tabIndex={-1}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="samples/:id" element={<SampleView />} />
          <Route path="photos" element={<PhotoCatalog />} />
          <Route path="photos/:id" element={<PhotoView />} />
          <Route path="references" element={<References />} />
          <Route path="page" element={<ContentPage key={location.search} />} />
          <Route
            path="*"
            element={
              <div className="n-wrap n-page">
                <h1>Page not found</h1>
                <Link to="/new/catalog">Explore the sample catalog →</Link>
              </div>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
