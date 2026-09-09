import { useState } from "react";
import type { ReactNode, FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { navigation, collections } from "../../data/navigation";
import { catalogPath } from "../../data/routes";
import { useData } from "../../api/useData";
import type { DatasetInfo } from "../../types/content";

export function SiteLink({
  to,
  children,
  ...props
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return to.startsWith("/") ? (
    <Link to={to} {...props}>
      {children}
    </Link>
  ) : (
    <a href={to} {...props}>
      {children}
    </a>
  );
}
function Sidebar() {
  const location = useLocation();
  const initial = navigation.findIndex((group) =>
    group.links.some(([, url]) => url === location.pathname),
  );
  const [open, setOpen] = useState(initial);
  return (
    <aside className="sidebar" aria-label="Lunar page navigation">
      <nav className="accordion">
        {navigation.map((group, i) => (
          <div className="nav-group" key={group.title}>
            <button
              aria-expanded={open === i}
              aria-controls={`nav-${i}`}
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              {group.title}
            </button>
            <ul id={`nav-${i}`} hidden={open !== i}>
              {group.links.map(([title, url]) => (
                <li key={url}>
                  <SiteLink to={url!}>{title}</SiteLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Link className="contact-link" to="/lunar/contacts.NOTcfm">
          ▸　 Lunar Curation Contacts
        </Link>
      </nav>
      <p className="external-links">
        <em>External Links</em>
        <br />
        <a href="https://www.hq.nasa.gov/office/pao/History/alsj/frame.html">
          ▸ Apollo Lunar Surface Journal
        </a>
      </p>
    </aside>
  );
}
function Footer() {
  const { data } = useData<DatasetInfo>("/api/dataset");
  return (
    <footer>
      <div className="footer-links">
        <ul>
          <li>
            <a href="https://www.nasa.gov/FOIA/">Freedom of Information Act</a>
          </li>
          <li>
            <a href="https://www.nasa.gov/about/highlights/HP_Privacy.html">
              NASA Privacy Policy, Accessibility and Important Notices
            </a>
          </li>
          <li>
            <a href="https://www.nasa.gov/about/contact/information_inventories_schedules.html">
              Information-Dissemination Priorities and Inventories
            </a>
          </li>
        </ul>
        <ul>
          <li>
            <a href="https://www.nasa.gov/offices/odeo/no-fear-act">
              Equal Employment Opportunity Data Posted Pursuant to the No Fear
              Act
            </a>
          </li>
          <li>
            <a href="https://www.nasa.gov/about/budget/index.html">
              Budgets, Strategic Plans and Accountability Reports
            </a>
          </li>
          <li>
            <a href="https://www.usa.gov/">USA.gov</a>
          </li>
          <li>
            <a href="https://get.adobe.com/reader/">Download Adobe Reader</a>
          </li>
        </ul>
      </div>
      <div className="footer-details">
        <a href="https://www.nasa.gov/">
          <img
            src="https://curator.jsc.nasa.gov/_images/footer_nasa_logo.png"
            alt="National Aeronautics and Space Administration"
          />
        </a>
        <div>
          Source: NASA Astromaterials Curation
          <br />
          <Link to="/lunar/contacts.NOTcfm">
            Lunar Curation Contacts
          </Link> · <Link to="/sitemap.NOTcfm">Site Map</Link>
          <br />
          <span className="dataset-label">
            Demo reconstruction · {data?.label ?? "Local preview"}
          </span>
        </div>
      </div>
      <div className="bottom-links">
        <Link to="/">Home</Link>
        {collections.map(([name, url]) => (
          <span key={name}>
            {" "}
            | <SiteLink to={url!}>{name}</SiteLink>
          </span>
        ))}
      </div>
    </footer>
  );
}
export function SiteLayout({
  children,
  wide = false,
  title,
}: {
  children: ReactNode;
  wide?: boolean;
  title: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("q")?.toString() ?? "";
    navigate(
      `/lunar/samplecatalog/sample_results_list.NOTcfm?q=${encodeURIComponent(query)}`,
    );
  }
  return (
    <div className="site-wrapper">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="agency-bar">
        <a href="https://www.nasa.gov/">
          <img
            src="https://curator.jsc.nasa.gov/_images/nasa_logo.gif"
            alt="National Aeronautics and Space Administration"
          />
        </a>
        <form className="site-search" onSubmit={search}>
          <button aria-label="Search catalog">⌕</button>
          <input
            aria-label="Search lunar catalog"
            name="q"
            placeholder="Search lunar samples"
          />
        </form>
      </div>
      <div className="site-surface">
        <header>
          <nav className="global-nav" aria-label="NASA curation navigation">
            {[
              ["Sample Collections", "https://curator.jsc.nasa.gov/"],
              [
                "Sample Request Deadlines",
                "https://curator.jsc.nasa.gov/bboard.cfm",
              ],
              ["Curation News", "https://curator.jsc.nasa.gov/news.cfm"],
              [
                "Astromaterials Newsletter",
                "https://curator.jsc.nasa.gov/newsletter",
              ],
              ["Education Samples", "/Education/index.NOTcfm"],
              ["NASA/ARES", "https://ares.jsc.nasa.gov/"],
            ].map(([name, url]) => (
              <SiteLink to={url!} key={name}>
                {name}
              </SiteLink>
            ))}
          </nav>
          <Link
            className="lunar-banner"
            to="/"
            aria-label="Curation Lunar home"
          />
          <nav className="collection-nav" aria-label="Sample collections">
            {collections.map(([name, url]) => (
              <SiteLink to={url!} key={name}>
                {name}
              </SiteLink>
            ))}
          </nav>
        </header>
        <div className="breadcrumbs">
          <Link to="/">Home</Link> →{" "}
          <Link to="/lunar/index.NOTcfm">Lunar Samples</Link>
          {title !== "Lunar Rocks and Soils from Apollo Missions" && (
            <> → {title}</>
          )}
        </div>
        <button
          className="mobile-nav-toggle"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          ☰ Lunar navigation
        </button>
        <div
          className={`page-grid ${wide ? "wide" : ""} ${mobileOpen ? "mobile-nav-open" : ""}`}
        >
          {(!wide || mobileOpen) && <Sidebar />}
          <main id="main" tabIndex={-1}>
            {children}
          </main>
        </div>
        {wide && (
          <div className="catalog-return">
            <Link to={catalogPath}>Lunar Sample and Photo Catalog</Link> ·{" "}
            <Link to="/">Lunar home</Link>
          </div>
        )}
        <Footer />
      </div>
    </div>
  );
}
