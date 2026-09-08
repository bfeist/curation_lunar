"""Pure HTML decoding. Uninterpreted structures are retained for later schema revisions."""

import re
from urllib.parse import parse_qs, urlsplit

from bs4 import BeautifulSoup, Tag

from .common import absolute_url, asset_kind


def soup_for(body):
    # NASA declares UTF-8 but some pages contain legacy single-byte spaces.
    # BeautifulSoup detects encodings without replacing invalid bytes prematurely.
    return BeautifulSoup(body, "lxml")


def text(node):
    return node.get_text(" ", strip=True) if node else ""


def main_node(soup):
    return soup.select_one("#main_content_wrapper") or soup.select_one("main") or soup.select_one("#portal-column-content") or soup.body or soup


def app_error(soup):
    title = text(soup.title).lower()
    message = text(soup).lower()
    return title == "error" or "an error occurred while executing the application" in message or "coldfusion error" in title


def key_values(soup):
    table = soup.select_one("table.datatab") or soup.find("table")
    fields = {}
    if table:
        for row in table.find_all("tr"):
            if row.find_parent("table") != table:
                continue
            cells = row.find_all(["td", "th"], recursive=False)
            if len(cells) == 2 and not cells[0].find(["table", "ul", "div"]):
                key = text(cells[0])
                if key:
                    fields[key] = text(cells[1])
    return fields


def successful_controls(form, overrides=None):
    """Serialize browser-successful controls, retaining empty/repeated select names."""
    overrides = overrides or {}
    pairs = []
    for control in form.select("input,select,textarea,button"):
        name = control.get("name")
        if not name or control.has_attr("disabled"):
            continue
        typ = control.get("type", "text").lower()
        if name in overrides:
            continue
        if control.name == "select":
            selected = control.select("option[selected]")
            if not selected and not control.has_attr("multiple"):
                first = control.find("option")
                selected = [first] if first else []
            pairs.extend((name, option.get("value", text(option))) for option in selected if not option.has_attr("disabled"))
        elif control.name == "textarea":
            pairs.append((name, control.get_text()))
        elif typ in ("checkbox", "radio"):
            if control.has_attr("checked"):
                pairs.append((name, control.get("value", "on")))
        elif typ not in ("button", "reset", "file", "image"):
            pairs.append((name, control.get("value", "")))
    for name, value in overrides.items():
        if value is None:
            continue
        pairs.extend((name, str(v)) for v in (value if isinstance(value, list) else [value]))
    return pairs


def forms(soup, url):
    out = []
    for form in soup.select("form"):
        controls = []
        for control in form.select("input,select,textarea,button"):
            controls.append({"tag": control.name, "name": control.get("name"), "type": control.get("type"), "value": control.get("value"), "text": text(control) if control.name != "select" else None, "checked": control.has_attr("checked"), "options": [{"value": i.get("value", text(i)), "text": text(i)} for i in control.select("option")]})
        out.append({"id": form.get("id"), "action": absolute_url(url, form.get("action", "")), "method": form.get("method", "GET").upper(), "controls": controls})
    return out


def links(soup, url):
    result = []
    for i, a in enumerate(soup.select("a[href]")):
        href = a["href"].strip()
        target = absolute_url(url, href)
        role = asset_kind(target) or ("fragment" if href.startswith("#") else "link")
        result.append({"original_href": href, "target_url": target, "label": text(a) or a.get("title", ""), "role": role, "ordinal": i})
    return result


def assets(soup, url):
    result = []
    for i, node in enumerate(soup.select("a[href],img,source,video,audio,object,embed,iframe")):
        attrs = ["href"] if node.name == "a" else ["src", "data-src", "data-original", "poster", "data"]
        for attr in attrs:
            raw = node.get(attr)
            if not raw:
                continue
            target = absolute_url(url, raw)
            kind = asset_kind(target)
            if node.name == "a" and not kind:
                continue
            if urlsplit(target).scheme not in ("http", "https"):
                continue
            result.append({"url": target, "kind": kind or "embedded_content", "original_url": raw, "role": f"{node.name}:{attr}", "label": text(node) or node.get("title", ""), "alt_text": node.get("alt"), "ordinal": i})
    return result


def tables(soup):
    result = []
    for table in soup.select("table"):
        rows = []
        for tr in table.select("tr"):
            if tr.find_parent("table") != table:
                continue
            rows.append([{"text": text(td), "html": str(td), "header": td.name == "th", "rowspan": td.get("rowspan", "1"), "colspan": td.get("colspan", "1")} for td in tr.find_all(["td", "th"], recursive=False)])
        result.append({"id": table.get("id"), "caption": text(table.find("caption")), "rows": rows})
    return result


def blocks(main):
    """Ordered semantic blocks plus HTML for faithful future rendering; never execute it."""
    out = []
    block_tags = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "table", "ul", "ol", "figure", "blockquote", "form", "img", "iframe", "video", "audio", "pre", "dl"}

    def walk(node):
        for child in node.children:
            if not isinstance(child, Tag):
                if str(child).strip() and getattr(child, "__class__").__name__ != "Comment":
                    out.append({"kind": "text", "text": str(child).strip()})
            elif child.name in {"script", "style", "noscript"}:
                continue
            elif child.name in block_tags:
                out.append({"kind": child.name, "text": text(child), "html": str(child)})
            else:
                walk(child)

    walk(main)
    return out


def linked_ids(soup, parameter, basename):
    found = []
    for a in soup.select("a[href]"):
        p = urlsplit(a["href"])
        if p.path.lower().endswith(basename):
            values = parse_qs(p.query).get(parameter, [])
            for value in values:
                found.append((value, a))
    return found


def reference_items(soup):
    result = []
    for item in soup.select("#reflist .list-item"):
        def field(selector):
            value = text(item.select_one(selector))
            return value.split(":", 1)[1].strip() if ":" in value else value
        desc = item.select_one(".desc")
        result.append({"authors_raw": field(".author"), "year": field(".year"), "title": field(".title"), "citation_text": text(desc), "citation_html": str(desc) if desc else "", "links": [a["href"] for a in item.select("a[href]")]})
    return result


def publication_links(soup, url):
    table = soup.select_one("table.datatab")
    result, active = [], False
    if table:
        for tr in table.select("tr"):
            if tr.find_parent("table") != table:
                continue
            if "amnheader" in tr.get("class", []):
                active = "Catalogs and Publications" in text(tr)
            elif active:
                result.extend({"title": text(a), "url": absolute_url(url, a["href"])} for a in tr.select("a[href]"))
    return result


def generic_tokens(value):
    # Only explicit Generic Number fields/links are interpreted; never mine captions.
    return re.findall(r"(?<!\d)\d{5}(?!\d)", value or "")
