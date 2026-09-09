import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { load } from "cheerio";
import {
  curationNavigation,
  collections,
  navigation,
} from "../src/data/navigation";
import { redesignUrl } from "../src/data/redesign";
import { Header, MegaMenu } from "../src/new/Header";
import { curationMenus, nasaMenus } from "../src/new/navigation";

describe("complete NASA and curation navigation", () => {
  it("retains every original global, collection and lunar-sidebar destination", () => {
    const links = curationMenus.flatMap((menu) => [
      menu.overview,
      ...menu.sections.flatMap((section) => section.links),
    ]);
    const destinations = new Set(links.map((link) => link.href));
    for (const [, href] of [
      ...curationNavigation,
      ...collections,
      ...navigation.flatMap((group) => group.links),
    ])
      expect(destinations.has(redesignUrl(href!)), href).toBe(true);
    expect(destinations.has(redesignUrl("/lunar/contacts.NOTcfm"))).toBe(true);
    expect(destinations.has(redesignUrl("/sitemap.NOTcfm"))).toBe(true);
  });
  it("separates agency navigation from curation, with valid closed disclosure controls", () => {
    const $ = load(
      renderToStaticMarkup(
        <MemoryRouter>
          <Header />
        </MemoryRouter>,
      ),
    );
    const navs = $("nav");
    expect(navs.eq(0).attr("aria-label")).toBe("NASA global navigation");
    expect(navs.eq(1).attr("aria-label")).toBe(
      "Lunar and astromaterials curation navigation",
    );
    expect(navs.eq(1).find("a").first().attr("href")).toBe("/new/catalog");
    expect($("iframe")).toHaveLength(0);
    const ids = $("[id]")
      .map((_i, element) => $(element).attr("id"))
      .get();
    expect(new Set(ids).size).toBe(ids.length);
    $(".n-menu-trigger").each((_i, element) => {
      expect($(element).attr("aria-expanded")).toBe("false");
      const panel = $(`#${$(element).attr("aria-controls")}`);
      expect(panel).toHaveLength(1);
      expect(panel.attr("hidden")).toBeDefined();
    });
    expect($(".n-menu-trigger")).toHaveLength(
      curationMenus.length + nasaMenus.length,
    );
    const search = $("#n-nasa-menu-search").closest("form");
    expect(search.attr("action")).toBe("https://www.nasa.gov/");
    expect(search.find("input").attr("name")).toBe("search");
  });
  it("renders each expanded panel with grouped links and an explicit close control", () => {
    for (const menu of [...curationMenus, ...nasaMenus]) {
      const $ = load(
        renderToStaticMarkup(
          <MemoryRouter>
            <MegaMenu menu={menu} open onClose={() => {}} />
          </MemoryRouter>,
        ),
      );
      expect($(".n-mega-panel").attr("hidden")).toBeUndefined();
      expect($("h2").text()).toBe(menu.title);
      expect($(".n-menu-columns section")).toHaveLength(menu.sections.length);
      expect($(".n-menu-close").attr("aria-label")).toContain(menu.label);
      for (const href of $("a")
        .map((_i, element) => $(element).attr("href"))
        .get())
        expect(href.startsWith("/new") || href.startsWith("https://")).toBe(
          true,
        );
    }
  });
});
