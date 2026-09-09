import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { curationMenus, nasaMenus } from "./navigation";
import type { MenuLink, NavigationMenu } from "./navigation";
import { nasaInsignia } from "./assets";
import "./navigation.css";

function NasaSearch({ inMenu = false }: { inMenu?: boolean }) {
  const id = inMenu ? "n-nasa-menu-search" : "n-nasa-search";
  return (
    <form
      className={
        inMenu ? "n-agency-search n-agency-menu-search" : "n-agency-search"
      }
      role="search"
      aria-label="Search NASA.gov"
      action="https://www.nasa.gov/"
      method="get"
    >
      <label className="n-sr" htmlFor={id}>
        Search NASA.gov
      </label>
      <input
        type="search"
        id={id}
        name="search"
        placeholder="Search NASA.gov"
        required
      />
      <button type="submit" aria-label="Search NASA.gov">
        <span aria-hidden="true">⌕</span>
      </button>
    </form>
  );
}

function Destination({
  link,
  overview = false,
}: {
  link: MenuLink;
  overview?: boolean;
}) {
  const content = (
    <>
      <span className="n-menu-link-label">
        {link.label}
        <span aria-hidden="true">
          {link.href.startsWith("/new") ? "→" : "↗"}
        </span>
      </span>
      {link.description && (
        <span className="n-menu-link-description">{link.description}</span>
      )}
    </>
  );
  return link.href.startsWith("/new") ? (
    <Link
      className={overview ? "n-menu-overview-link" : undefined}
      to={link.href}
    >
      {content}
    </Link>
  ) : (
    <a
      className={overview ? "n-menu-overview-link" : undefined}
      href={link.href}
    >
      {content}
    </a>
  );
}

export function MegaMenu({
  menu,
  open,
  onClose,
  agency = false,
}: {
  menu: NavigationMenu;
  open: boolean;
  onClose: () => void;
  agency?: boolean;
}) {
  return (
    <div
      id={`n-menu-${menu.id}`}
      className={`n-mega-panel${agency ? " n-agency-panel" : ""}`}
      hidden={!open}
    >
      <div className="n-wrap n-mega-content">
        <div className="n-menu-intro">
          <p className="n-eyebrow">
            {agency
              ? "National Aeronautics and Space Administration"
              : "Astromaterials Curation"}
          </p>
          <h2>{menu.title}</h2>
          <p>{menu.description}</p>
          <Destination link={menu.overview} overview />
          {menu.id === "nasa-explore" && <NasaSearch inMenu />}
        </div>
        <div className="n-menu-columns">
          {menu.sections.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.links.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <Destination link={link} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <button
          type="button"
          className="n-menu-close"
          aria-label={`Close ${menu.label} menu`}
          onClick={onClose}
        >
          Close <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  );
}

export function Header() {
  const location = useLocation();
  const [menu, setMenu] = useState<{ key: string; id: string } | null>(null);
  const [mobileKey, setMobileKey] = useState<string | null>(null);
  const header = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  const active = menu?.key === location.key ? menu.id : null;
  const mobileOpen = mobileKey === location.key;
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) {
        setMenu(null);
        setMobileKey(null);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function closeMenu() {
    setMenu(null);
    opener.current?.focus();
  }
  function trigger(item: NavigationMenu) {
    return (
      <button
        type="button"
        className="n-menu-trigger"
        id={`n-trigger-${item.id}`}
        aria-expanded={active === item.id}
        aria-controls={`n-menu-${item.id}`}
        aria-label={item.id === "nasa-explore" ? "Explore NASA" : undefined}
        onClick={(event) => {
          opener.current = event.currentTarget;
          setMenu(
            active === item.id ? null : { key: location.key, id: item.id },
          );
          if (item.id.startsWith("nasa-")) setMobileKey(null);
        }}
      >
        {item.label}
        <svg
          className="n-menu-chevron"
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    );
  }
  return (
    <header
      className="n-header n-expanded-header"
      ref={header}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          if (active) {
            event.preventDefault();
            closeMenu();
          } else if (mobileOpen) {
            event.preventDefault();
            setMobileKey(null);
            mobileButton.current?.focus();
          }
        }
      }}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget as Node)
        ) {
          setMenu(null);
          setMobileKey(null);
        }
      }}
      onClick={(event) => {
        if ((event.target as Element).closest("a[href]")) {
          setMenu(null);
          setMobileKey(null);
        }
      }}
    >
      <nav className="n-agency-navigation" aria-label="NASA global navigation">
        <div className="n-wrap n-agency-bar">
          <div className="n-agency-explore">
            {trigger(nasaMenus[0]!)}
            <NasaSearch />
            <MegaMenu
              menu={nasaMenus[0]!}
              open={active === nasaMenus[0]!.id}
              onClose={closeMenu}
              agency
            />
          </div>
          <a
            className="n-agency-logo"
            href="https://www.nasa.gov/"
            aria-label="NASA home"
          >
            <img src={nasaInsignia} alt="NASA" width="64" height="54" />
          </a>
          <div className="n-agency-actions">
            {nasaMenus.slice(1).map((item) => (
              <div key={item.id}>
                {trigger(item)}
                <MegaMenu
                  menu={item}
                  open={active === item.id}
                  onClose={closeMenu}
                  agency
                />
              </div>
            ))}
            <a className="n-nasa-plus" href="https://plus.nasa.gov/">
              NASA<span aria-hidden="true">+</span>
            </a>
          </div>
        </div>
      </nav>
      <div className="n-wrap n-project-bar">
        <Link className="n-project-name" to="/new">
          Lunar Curation
          <small>Astromaterials Research & Exploration Science</small>
        </Link>
        <span className="n-project-preview">Design preview</span>
        <button
          ref={mobileButton}
          type="button"
          className="n-project-toggle"
          aria-expanded={mobileOpen}
          aria-controls="n-project-navigation"
          onClick={() => {
            setMobileKey(mobileOpen ? null : location.key);
            setMenu(null);
          }}
        >
          Curation menu{" "}
          <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
        </button>
      </div>
      <nav
        id="n-project-navigation"
        className={`n-project-navigation${mobileOpen ? " is-open" : ""}`}
        aria-label="Lunar and astromaterials curation navigation"
      >
        <div className="n-wrap n-project-nav-inner">
          <NavLink className="n-primary-catalog" to="/new/catalog">
            Sample catalog <span aria-hidden="true">→</span>
          </NavLink>
          {curationMenus.map((item) => (
            <div className="n-project-nav-group" key={item.id}>
              {trigger(item)}
              <MegaMenu
                menu={item}
                open={active === item.id}
                onClose={closeMenu}
              />
            </div>
          ))}
        </div>
      </nav>
    </header>
  );
}
