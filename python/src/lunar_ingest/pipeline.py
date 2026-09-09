import json
import re
from urllib.parse import parse_qs, quote, urlencode, urlsplit

from . import __version__
from .client import BudgetReached, Client, FetchError
from .common import API, CATALOG, HOME, ORIGIN, absolute_url, asset_kind, boolean, date_iso, digest, identifier, json_text, number, request_url, utcnow
from . import html
from .storage import write_json

SAMPLE_FIELDS = {
    "SAMPLEID": "source_sample_id", "MISSION": "mission", "STATION": "station_raw",
    "LANDMARK": "landmark_raw", "BAGNUMBER": "bag_number", "ORIGINALWEIGHT": "original_weight_g",
    "SAMPLETYPE": "sample_type", "SAMPLESUBTYPE": "sample_subtype", "PRISTINITY": "pristine_percent",
    "PRISTINITYDATE": "pristinity_date_raw", "HASTHINSECTION": "has_thin_section",
    "HASDISPLAYSAMPLE": "has_display_sample", "DISPLAYSAMPLENUMBER": "display_sample_number_raw",
    "GENERICDESCRIPTION": "description",
}
HTML_SAMPLE_FIELDS = {
    "Mission": "mission", "Station": "station_raw", "Landmark": "landmark_raw",
    "Bag Number": "bag_number", "Rock Type": "sample_type", "Rock Subtype": "sample_subtype",
    "Description": "description",
}

# These catalog searches consistently exceed the public site's response window.
# `ALL/*` is an optional cross-check for unassigned photos, while the three
# mission/type combinations have no usable public response. They are not
# required to acquire details for IDs found through galleries and responsive
# mission/type searches.
SKIPPED_PHOTO_SEARCH_PARTITIONS = {
    "Apollo 15/processing",
    "Apollo 16/processing",
    "Apollo 17/thin section",
    "ALL/ortho",
    "ALL/stereo",
    "ALL/thin section",
    "ALL/processing",
}


class Pipeline:
    def __init__(self, store, config):
        self.store = store
        self.config = config

    def seed(self):
        with self.store.db:
            self.store.enqueue(API + "listmissions", "missions", priority=0)
            self.store.enqueue(API + "listsampleclassification", "vocabulary", {"endpoint": "listsampleclassification"}, priority=5)
            self.store.enqueue(HOME, "page", priority=10)
            self.store.enqueue(CATALOG, "catalog", priority=10)
            self.store.enqueue(ORIGIN + "/sitemap.cfm", "page", priority=15)
            self.store.enqueue(ORIGIN + "/robots.txt", "policy", priority=0)
            for generic in self.config["samples"]:
                self.schedule_sample(generic)

    def selected(self, generic):
        return self.config["mode"] == "full" or generic in self.config["samples"]

    def schedule_sample(self, generic):
        self.store.sample_stub(generic)
        if not self.selected(generic):
            return
        sample = self.store.rows("SELECT source_json,has_thin_section,has_display_sample FROM samples WHERE generic=?", (generic,))[0]
        endpoints = []
        # A complete baseline comparison found all 2,381 non-empty detail responses
        # field-for-field identical to their mission inventory rows. Keep details for
        # pilot/HTML-only discoveries, but do not refetch known full-inventory rows.
        if self.config["mode"] != "full" or not sample["source_json"]:
            endpoints.append(("sampledetails", "sample_detail"))
        # The full baseline also found no related rows behind a false/empty flag.
        # HTML-only discoveries still get all endpoint checks because they have
        # not passed through the audited mission inventory.
        if self.config["mode"] != "full" or not sample["source_json"] or bool(sample["has_thin_section"]):
            endpoints.append(("samplethinsections", "thin_sections"))
        if self.config["mode"] != "full" or not sample["source_json"] or bool(sample["has_display_sample"]):
            endpoints.append(("sampledisplays", "displays"))
        for endpoint, kind in endpoints:
            self.store.enqueue(API + endpoint + "/" + quote(generic, safe=""), kind, {"generic": generic}, priority=20)
        self.store.enqueue(ORIGIN + "/lunar/samplecatalog/sampleinfo.cfm?sample=" + quote(generic, safe=""), "sample_page", {"generic": generic}, priority=30)

    def schedule_photo(self, photo_id, url):
        self.store.photo_stub(photo_id)
        self.store.requirement(url, "Photo detail", "photo", mapping=f"photos:{photo_id}")
        count = self.store.db.execute("SELECT COUNT(*) FROM requests WHERE kind='photo_page'").fetchone()[0]
        limit = self.config["photo_limit"]
        if self.config["mode"] == "full" or not limit or count < limit:
            self.store.enqueue(url, "photo_page", {"photo_id": photo_id}, priority=40)

    def follow(self, link, base_context):
        url = request_url(link["target_url"])
        parsed = urlsplit(url)
        if parsed.hostname != "curator.jsc.nasa.gov" or parsed.scheme not in ("https", "http"):
            return
        if asset_kind(url) or link["role"] == "fragment":
            return
        path = parsed.path.lower()
        query = parse_qs(parsed.query)
        if "/images/" in path and path.endswith("/"):
            return  # Static asset directories are not HTML content inventories.
        if any(str(value).lower() in {"xcel", "excel", "pdf", "csv", "download"} for value in query.get("type", [])):
            return  # Export endpoints can serve binary assets despite their .cfm extension.
        if not path.startswith("/lunar/"):
            # Supporting public guidance linked directly by the Lunar navigation.
            if path not in ("/sitemap.cfm", "/education/index.cfm", "/lunar/sampreq/requestdates.cfm", "/displays/index.cfm"):
                return
        if path.endswith("sampleinfo.cfm"):
            for generic in query.get("sample", []):
                self.schedule_sample(generic)
            return
        if path.endswith("photoinfo.cfm"):
            for photo_id in query.get("photo", []):
                if self.config["mode"] == "full" or base_context.get("generic") in self.config["samples"]:
                    self.schedule_photo(photo_id, url)
            return
        if path.endswith("feedbackform.cfm"):
            # Every catalog detail page carries a photo- or sample-specific
            # "Report a problem" link. It is an interactive submission form,
            # not editorial content, so never fan out one request per record.
            return
        if path.endswith("thinsections.cfm"):
            generic = query.get("sample", [None])[0]
            if generic and self.selected(generic):
                self.store.enqueue(url, "thin_page", {"generic": generic}, priority=35)
            return
        if path.endswith("/references/samples_popup.cfm"):
            source_id = query.get("refid", [None])[0]
            if source_id:
                self.store.enqueue(url, "reference_samples", {"reference_id": "nasa-ref:" + source_id}, priority=45)
            return
        if path.endswith(("sample_results_list.cfm", "photo_results_list.cfm")):
            # Observed GET pagination can be followed; preserve POST state for same-route links.
            if parsed.query and base_context.get("result_kind"):
                params = base_context.get("params", [])
                self.store.enqueue(url, base_context["result_kind"], base_context, params=params, priority=45)
            return
        if path.endswith((".cfm", ".html", ".htm", "/")):
            self.store.requirement(url, "Page", "page")
            count = self.store.db.execute("SELECT COUNT(*) FROM requests WHERE kind='page'").fetchone()[0]
            if self.config["mode"] == "full" or count < self.config["page_limit"]:
                # Acquire the bounded editorial route inventory before the much
                # larger sample/photo detail fan-out so early snapshots remain useful.
                self.store.enqueue(url, "catalog" if url == CATALOG else "page", priority=15)

    def parse(self, task, response):
        body = (self.store.root / response["body_path"]).read_bytes()
        if digest(body) != response["sha256"]:
            raise ValueError("Cached response hash mismatch")
        kind = task["kind"]
        context = json.loads(task["context_json"])
        if kind == "policy":
            self.store.issue("crawl_policy", "site", ORIGIN, "robots.txt recorded; this run performs the user-requested public-view reconstruction with sequential metadata requests.", {"response_id": response["response_id"]}, severity="info", disposition="recorded")
            return
        if kind in {"missions", "vocabulary", "mission_samples", "sample_detail", "thin_sections", "displays", "alternate_samples"}:
            self.parse_api(kind, context, response, body)
        else:
            self.parse_html(kind, context, response, body, task)

    def parse_api(self, kind, context, response, body):
        data = json.loads(body)
        if not isinstance(data, list) or not all(isinstance(row, dict) for row in data):
            raise ValueError("Expected a JSON array of objects; source schema changed")
        rid = response["response_id"]
        if kind == "missions":
            if not data:
                raise ValueError("Mission inventory unexpectedly empty")
            for row in data:
                mission = row["MISSION"]
                self.store.upsert("missions", {"name": mission, "source_json": json_text(row)}, key="name")
                self.store.enqueue(API + "samplesbymission/" + quote(mission, safe=""), "mission_samples", {"mission": mission}, priority=5)
                for endpoint in ("liststationsbymission", "listlandmarksbymission"):
                    self.store.enqueue(API + endpoint + "/" + quote(mission, safe=""), "vocabulary", {"endpoint": endpoint, "mission": mission}, priority=8)
            return
        if kind == "vocabulary":
            for i, row in enumerate(data):
                self.store.upsert("vocabulary_values", {"id": digest([context, row]), "kind": context["endpoint"], "mission": context.get("mission"), "value_json": json_text(row), "response_id": rid})
                if self.config["mode"] == "full":
                    self.alternate_inventory(context, row)
            return
        if kind in {"mission_samples", "sample_detail", "alternate_samples"}:
            if kind == "sample_detail" and not data:
                generic = context["generic"]
                self.store.issue("source_unavailable", "sample", generic, "The sample-detail API returned an empty array for an inventoried sample", {"response_id": rid}, disposition="source_unavailable")
                self.store.requirement(response["final_url"], "API sample detail", "sample", mapping=f"samples:{generic}", status="source_unavailable", evidence=rid)
                return
            if kind == "sample_detail" and not any(identifier(r.get("GENERIC")) == context["generic"] for r in data):
                raise ValueError("Sample-detail response contained a different generic")
            for i, row in enumerate(data):
                generic = identifier(row.get("GENERIC"))
                if not generic:
                    raise ValueError("Sample row missing GENERIC")
                self.sample_record(row, rid, f"$[{i}]")
                self.store.member("sample", generic, "api_mission" if kind == "mission_samples" else kind, context.get("mission", context.get("partition", context.get("generic", ""))), rid)
                self.schedule_sample(generic)
            return
        generic = context["generic"]
        self.store.sample_stub(generic)
        for i, row in enumerate(data):
            row_generic = identifier(row.get("GENERIC")) or generic
            if row_generic != generic:
                self.store.issue("response_relationship", "sample", generic, "Related endpoint returned another generic", row)
            self.store.sample_stub(row_generic)
            record_id = digest([kind, row])
            if kind == "thin_sections":
                availability = row.get("AVAILABILITY")
                self.store.upsert("thin_sections", {"id": record_id, "generic": row_generic, "specific": identifier(row.get("SPECIFIC")), "weight_g": number(row.get("WEIGHT")), "description": row.get("DESCRIPTION"), "availability_code": str(availability) if availability is not None else None, "availability_label": {"1": "Available", "0": "On loan"}.get(str(availability)), "source_json": json_text(row)})
            else:
                location_fields = {k: v for k, v in row.items() if k not in ("GENERIC", "SPECIFIC", "DISPLAYDESCRIPTION")}
                location_id = digest(location_fields)
                location = {"id": location_id, "source_location_id": identifier(row.get("ID")), "name": row.get("DISPLAYLOCATION"), "url": row.get("DISPLAYURL"), "region": row.get("REGION"), "address_line1": row.get("ADD_LINE1"), "address_line2": row.get("ADD_LINE2"), "address_line3": row.get("ADD_LINE3"), "phone": row.get("PHONE"), "city": row.get("CITY"), "state": row.get("STATE"), "country": row.get("COUNTRY"), "country_id": row.get("COUNTRYID"), "latitude": number(row.get("LATITUDE")), "longitude": number(row.get("LONGITUDE")), "zoom_level": row.get("ZOOMLEVEL"), "source_json": json_text(location_fields)}
                self.store.upsert("display_locations", location)
                self.store.evidence("display_location", location_id, rid, f"$[{i}]")
                self.store.upsert("sample_displays", {"id": record_id, "generic": row_generic, "specific": identifier(row.get("SPECIFIC")), "location_id": location_id, "description": row.get("DISPLAYDESCRIPTION"), "source_json": json_text(row)})
            self.store.evidence(kind, record_id, rid, f"$[{i}]")
            for field, value in row.items():
                self.store.observe(kind, record_id, field, value, rid, f"$[{i}].{field}")

    def alternate_inventory(self, context, row):
        endpoint = context["endpoint"]
        mission = context.get("mission", "")
        # Lookup shapes are checked rather than guessed; unsupported keys remain in vocabulary_values.
        if endpoint == "listsampleclassification" and row.get("SAMPLETYPE"):
            typ = row["SAMPLETYPE"]
            self.store.enqueue(API + "samplesbyclassification/" + quote(typ, safe=""), "alternate_samples", {"partition": f"type:{typ}"}, priority=12)
            if row.get("SAMPLESUBTYPE"):
                subtype = row["SAMPLESUBTYPE"]
                self.store.enqueue(API + "samplesbysubtype/" + quote(typ, safe="") + "?subtype=" + quote(subtype, safe=""), "alternate_samples", {"partition": f"subtype:{typ}/{subtype}"}, priority=13)
        elif endpoint in {"liststationsbymission", "listlandmarksbymission"}:
            field, function = ("STATION", "samplesbystation") if "stations" in endpoint else ("LANDMARK", "samplesbylandmark")
            if row.get(field):
                self.store.enqueue(API + function + "/" + quote(mission, safe="") + "/" + quote(row[field], safe=""), "alternate_samples", {"partition": f"{mission}/{field}/{row[field]}"}, priority=13)

    def sample_record(self, row, rid, locator):
        generic = identifier(row["GENERIC"])
        self.store.sample_stub(generic)
        values = {"generic": generic, "record_status": "api", "source_json": json_text(row), "detail_url": ORIGIN + "/lunar/samplecatalog/sampleinfo.cfm?sample=" + quote(generic, safe="")}
        for source, column in SAMPLE_FIELDS.items():
            if source not in row:
                self.store.issue("schema_drift", "sample", generic, f"Missing expected API field: {source}", {"response_id": rid})
                continue
            raw = row[source]
            if column in ("original_weight_g", "pristine_percent"):
                raw = number(raw)
            elif column.startswith("has_"):
                raw = boolean(raw)
            values[column] = raw
        values["pristinity_date"] = date_iso(row.get("PRISTINITYDATE"))
        existing = self.store.rows("SELECT * FROM samples WHERE generic=?", (generic,))[0]
        for key, value in list(values.items()):
            if value is None and existing.get(key) is not None:
                del values[key]
        self.store.upsert("samples", values, key="generic")
        self.store.evidence("sample", generic, rid, locator)
        for field, value in row.items():
            self.store.observe("sample", generic, field, value, rid, locator + "." + field)
            if field not in SAMPLE_FIELDS and field != "GENERIC":
                self.store.issue("schema_drift", "sample", generic, f"New API field retained: {field}", {"response_id": rid})

    def parse_html(self, kind, context, response, body, task):
        soup = html.soup_for(body)
        if html.app_error(soup):
            raise ValueError("Application error document (not an empty result)")
        main = html.main_node(soup)
        url, rid = response["final_url"], response["response_id"]
        # Different POST searches share a URL but are distinct public content states.
        page_key = url + "#request=" + task["request_id"] if task["method"] == "POST" else url
        fields = html.key_values(soup) if kind in {"sample_page", "photo_page"} else {}
        identities = {"sample_page": ("Generic Number", "sample", "generic"), "photo_page": ("Photo Number", "photo", "photo_id")}
        if kind in identities:
            label, entity_type, context_key = identities[kind]
            expected = context[context_key]
            actual = fields.get(label)
            if not actual:
                self.store.issue("source_unavailable", entity_type, expected, f"The HTML detail route returned a page shell without a {entity_type} record", {"response_id": rid, "url": url}, disposition="source_unavailable")
                self.store.requirement(url, f"HTML {entity_type} detail", entity_type, mapping=f"{entity_type}s:{expected}", status="source_unavailable", evidence=rid)
                return
            if actual != expected:
                raise ValueError(f"HTML {entity_type} identity differs from requested record")
        self.store.upsert("pages", {"url": page_key, "page_type": kind, "title": html.text(soup.title) or html.text(main.find(["h1", "h2"])), "main_text": html.text(main), "main_html": str(main), "fields_json": json_text(fields), "forms_json": json_text(html.forms(soup, url)), "tables_json": json_text(html.tables(main)), "response_id": rid}, key="url")
        self.store.requirement(page_key, "Page", "page", mapping="pages:" + page_key, status="acquired_unreviewed", evidence=rid)
        for i, block in enumerate(html.blocks(main)):
            self.store.upsert("content_blocks", {"id": digest([page_key, i]), "page_url": page_key, "ordinal": i, "kind": block["kind"], "content_json": json_text(block), "response_id": rid})
        for i, heading in enumerate(main.select("h1,h2,h3,h4,h5,h6,tr.amnheader")):
            self.store.requirement(page_key, f"{i}: {html.text(heading)}", "section", mapping="pages:" + page_key, status="acquired_unreviewed", evidence=rid)
        for asset in html.assets(main, url):
            self.store.upsert("assets", {"url": asset["url"], "kind": asset["kind"]}, key="url")
            self.store.upsert("asset_occurrences", {"id": digest([page_key, asset["ordinal"], asset["role"], asset["url"]]), "asset_url": asset["url"], "page_url": page_key, "original_url": asset["original_url"], "role": asset["role"], "label": asset["label"], "alt_text": asset["alt_text"], "ordinal": asset["ordinal"], "response_id": rid})
        all_links = html.links(soup, url)
        for link in all_links:
            self.store.upsert("page_links", {"id": digest([page_key, link["ordinal"]]), "page_url": page_key, **link, "response_id": rid})
        if kind == "catalog":
            self.catalog_queries(soup, url)
        if urlsplit(url).path.lower().endswith("/references/index.cfm"):
            self.reference_queries(soup, url)
        if kind == "sample_page":
            self.sample_html(soup, fields, context["generic"], response)
        if kind == "photo_page":
            self.photo_html(soup, fields, context["photo_id"], response)
        if kind in {"sample_results", "photo_results"}:
            self.search_results(soup, kind, context, response)
        if kind == "reference_results":
            self.reference_results(soup, response)
        if kind == "reference_samples":
            ref_id = context["reference_id"]
            self.store.db.execute("INSERT OR IGNORE INTO bibliographic_references(id) VALUES(?)", (ref_id,))
            for i, (generic, _) in enumerate(html.linked_ids(soup, "sample", "sampleinfo.cfm")):
                self.reference_relationship(generic, ref_id, rid, i)
        if kind == "thin_page":
            self.store.observe("sample", context["generic"], "thin_section_table", html.tables(main), rid, "table")
        if kind == "page" and not main.select("table,p,h1,h2,h3,h4,li,img"):
            self.store.issue("content_review", "page", url, "No expected content blocks found; inspect template or dynamic content", {"response_id": rid})
        for link in all_links:
            self.follow(link, {**context, "result_kind": kind if kind in {"sample_results", "photo_results"} else None, "params": json.loads(task["params_json"])})
        if kind == "page" and (main.select("iframe,embed,object") or any(".load(" in script.get_text() or "$.ajax" in script.get_text() or "fetch(" in script.get_text() for script in soup.select("script:not([src])"))):
            self.store.issue("dynamic_content_review", "page", url, "Embedded or dynamically loaded content needs a rendered-page parity check; URLs and source HTML retained", {"response_id": rid})

    def catalog_queries(self, soup, url):
        sample_form = soup.select_one("form#missionsearch")
        photo_form = soup.select_one("form#advphotosearch")
        if not sample_form or not photo_form:
            raise ValueError("Expected mission/photo forms missing")
        missions = [r["name"] for r in self.store.rows("SELECT name FROM missions ORDER BY name")]
        # Preserve the form's actual option values (LUNA vs Luna), while comparing canonical names.
        values = {i.get("value", "").casefold(): i.get("value") for i in sample_form.select('input[name="missionOptions"]')}
        for mission in missions:
            params = html.successful_controls(sample_form, {"missionOptions": values.get(mission.casefold(), mission)})
            self.store.enqueue(absolute_url(url, sample_form.get("action")), "sample_results", {"mission": mission, "partition": mission}, params, priority=25)
        if self.config["mode"] == "full":
            photo_types = [control.get("value") for control in photo_form.select('input[name="photoOptions"][value]')]
            # Broad mission photo searches timed out after 90 seconds because the
            # site renders very large result pages. Mission/type partitions cover
            # the documented photo vocabulary and remain independently auditable.
            queries = [(f"{mission}/{photo_type}", {"missionOptions": mission, "photoOptions": photo_type, "advgeneric": "", "advphoto": ""}) for mission in missions for photo_type in photo_types]
            queries.extend((f"ALL/{photo_type}", {"missionOptions": None, "photoOptions": photo_type, "advgeneric": "", "advphoto": ""}) for photo_type in photo_types)
            queries = [(partition, overrides) for partition, overrides in queries if partition not in SKIPPED_PHOTO_SEARCH_PARTITIONS]
            sample_adv = soup.select_one("form#advsamplesearch")
            if sample_adv:
                self.store.enqueue(absolute_url(url, sample_adv.get("action")), "sample_results", {"partition": "ALL"}, html.successful_controls(sample_adv, {"missionOptions": None, "generic": ""}), priority=25)
        else:
            queries = [(f"sample:{g}", {"advgeneric": g, "advphoto": "", "missionOptions": None}) for g in self.config["samples"]]
        for partition, overrides in queries:
            params = html.successful_controls(photo_form, overrides)
            self.store.enqueue(absolute_url(url, photo_form.get("action")), "photo_results", {"partition": partition}, params, priority=12)

    def sample_html(self, soup, fields, generic, response):
        rid, url = response["response_id"], response["final_url"]
        self.store.sample_stub(generic)
        for field, value in fields.items():
            self.store.observe("sample", generic, "html:" + field, value, rid, "table.datatab")
        row = self.store.rows("SELECT * FROM samples WHERE generic=?", (generic,))[0]
        fill = {"generic": generic, "detail_url": url, "record_status": "api_and_html" if row["source_json"] else "html"}
        for label, column in HTML_SAMPLE_FIELDS.items():
            if row.get(column) is None and fields.get(label):
                fill[column] = fields[label]
        for label, column in [("Original Weight", "original_weight_g"), ("Percent of Pristine Sample Available", "pristine_percent")]:
            if row.get(column) is None and fields.get(label):
                match = re.fullmatch(r"\s*([+-]?[\d.]+)\s*(?:g|%)?\s*", fields[label])
                if match:
                    fill[column] = number(match.group(1))
        if not row.get("pristinity_date") and fields.get("Date of Pristinity Calculation"):
            fill["pristinity_date_raw"] = fields["Date of Pristinity Calculation"]
            fill["pristinity_date"] = date_iso(fill["pristinity_date_raw"])
        self.store.upsert("samples", fill, key="generic")
        self.store.evidence("sample", generic, rid, "table.datatab")
        for i, publication in enumerate(html.publication_links(soup, url)):
            pid = digest(publication)
            self.store.upsert("publications", {"id": pid, **publication, "metadata_json": json_text(publication)})
            self.store.upsert("sample_publications", {"id": digest([generic, pid, rid, i]), "generic": generic, "publication_id": pid, "label": publication["title"], "response_id": rid, "ordinal": i})
        for i, reference in enumerate(html.reference_items(soup)):
            ref_id = digest(reference)
            values = {k: v for k, v in reference.items() if k != "links"}
            self.store.upsert("bibliographic_references", {"id": ref_id, **values, "links_json": json_text(reference["links"])})
            self.store.upsert("sample_references", {"id": digest([generic, ref_id, rid, i]), "generic": generic, "reference_id": ref_id, "response_id": rid, "ordinal": i})
        gallery = soup.select_one("#gallery")
        for i, (photo_id, a) in enumerate(html.linked_ids(gallery or html.soup_for(b""), "photo", "photoinfo.cfm")):
            self.store.photo_stub(photo_id)
            self.photo_relationship(generic, photo_id, None, "sample_gallery", rid, i)
            self.store.member("photo", photo_id, "sample_gallery", generic, rid)
            self.schedule_photo(photo_id, absolute_url(url, a["href"]))

    def reference_queries(self, soup, url):
        form = soup.select_one("form#searchref")
        if form is None:
            raise ValueError("Expected bibliography search form missing")
        generics = [""] if self.config["mode"] == "full" else self.config["samples"]
        for generic in generics:
            params = html.successful_controls(form, {"samplename": generic, "author": "", "title": "", "keyword": ""})
            target = absolute_url(url, form.get("action"))
            if form.get("method", "GET").upper() == "GET":
                target += "?" + urlencode(params)
                params = None
            self.store.enqueue(target, "reference_results", {"partition": generic or "ALL"}, params=params, priority=42)

    def reference_relationship(self, generic, ref_id, rid, ordinal):
        self.store.sample_stub(generic)
        self.store.upsert("sample_references", {"id": digest([generic, ref_id, rid, ordinal]), "generic": generic, "reference_id": ref_id, "response_id": rid, "ordinal": ordinal})
        self.store.member("sample", generic, "reference", ref_id, rid)
        self.schedule_sample(generic)

    def reference_results(self, soup, response):
        table = soup.select_one("table#refresults")
        if table is None:
            if "No references found matching search criteria entered." in html.text(html.main_node(soup)):
                return
            raise ValueError("Expected bibliography results table missing")
        rid, url = response["response_id"], response["final_url"]
        for i, tr in enumerate(table.select("tbody > tr")):
            cells = tr.find_all("td", recursive=False)
            if len(cells) != 2:
                raise ValueError("Unexpected bibliography result columns")
            citation = html.text(cells[0])
            popup = cells[1].select_one('a[href*="samples_popup.cfm"]')
            source_id = parse_qs(urlsplit(popup["href"]).query).get("refid", [None])[0] if popup else None
            ref_id = "nasa-ref:" + source_id if source_id else digest(["citation", citation])
            self.store.upsert("bibliographic_references", {"id": ref_id, "citation_text": citation, "citation_html": str(cells[0]), "links_json": json_text([absolute_url(url, a["href"]) for a in cells[0].select("a[href]")])})
            self.store.evidence("reference", ref_id, rid, f"#refresults tbody tr[{i}]")
            for j, (generic, _) in enumerate(html.linked_ids(cells[1], "sample", "sampleinfo.cfm")):
                self.reference_relationship(generic, ref_id, rid, i * 100000 + j)
            if popup:
                self.store.enqueue(absolute_url(url, popup["href"]), "reference_samples", {"reference_id": ref_id}, priority=45)

    def photo_relationship(self, generic, photo_id, specifics, source, rid, ordinal):
        self.store.sample_stub(generic)
        self.store.photo_stub(photo_id)
        self.store.upsert("sample_photos", {"id": digest([generic, photo_id, source, rid, ordinal]), "generic": generic, "photo_id": photo_id, "specifics_raw": specifics, "relationship_source": source, "response_id": rid, "ordinal": ordinal})

    def photo_html(self, soup, fields, photo_id, response):
        rid, url = response["response_id"], response["final_url"]
        self.store.upsert("photos", {"photo_id": photo_id, "detail_url": url, "photo_type": fields.get("Photo Type"), "photo_subtype": fields.get("Photo Subtype"), "film_type": fields.get("Film Type"), "description": fields.get("Photo Description"), "angle_raw": fields.get("Angle"), "orientation_raw": fields.get("Orientation"), "related_specifics_raw": fields.get("Related Specifics"), "fields_json": json_text(fields), "record_status": "html"}, key="photo_id")
        self.store.requirement(url, "Photo detail", "photo", mapping="photos:" + photo_id, status="acquired_unreviewed", evidence=rid)
        for field, value in fields.items():
            self.store.observe("photo", photo_id, field, value, rid, "table.datatab")
        for i, generic in enumerate(html.generic_tokens(fields.get("Generic Number"))):
            self.photo_relationship(generic, photo_id, fields.get("Related Specifics"), "photo_detail", rid, i)
            self.store.member("sample", generic, "photo_detail", photo_id, rid)
            self.schedule_sample(generic)

    def search_results(self, soup, kind, context, response):
        rid, url = response["response_id"], response["final_url"]
        photo = kind == "photo_results"
        entity_type = "photo" if photo else "sample"
        found = html.linked_ids(soup, "photo" if photo else "sample", "photoinfo.cfm" if photo else "sampleinfo.cfm")
        # The live photo search represents emptiness as a recognized header + empty tbody.
        result_table = soup.select_one("table#advphotosearch" if photo else "table#mission,table#advsamplesearch")
        empty_table = bool(result_table and result_table.find("tbody") is not None and not result_table.find("tbody").find("tr") and ("Photo #" if photo else "Generic") in html.text(result_table.find("thead")))
        if not found and not empty_table and not any(term in html.text(soup).lower() for term in ("no results", "no samples", "no photos", "0 records", "no records", "no matching")):
            self.store.issue("result_exhaustion", "page", url + "#" + context["partition"], "No record links or recognized empty-result marker; inspect response", {"response_id": rid}, severity="error")
        for i, (entity_id, a) in enumerate(found):
            self.store.member(entity_type, entity_id, "html_photo_search" if photo else "html_mission" if context.get("mission") else "html_sample_search", context["partition"], rid)
            if photo:
                self.store.photo_stub(entity_id)
                parent = a.find_parent("tr") or a.find_parent(class_="list-item")
                self.store.observe("photo", entity_id, "search_row", html.text(parent), rid, f"result[{i}]")
                if parent:
                    table = parent.find_parent("table")
                    headers = [html.text(th) for th in table.select("thead th")] if table else []
                    cells = parent.find_all("td", recursive=False)
                    row_fields = dict(zip(headers, (html.text(td) for td in cells)))
                    self.store.observe("photo", entity_id, "search_fields", row_fields, rid, f"result[{i}]")
                    if row_fields.get("Mission"):
                        self.store.upsert("photos", {"photo_id": entity_id, "mission_raw": row_fields["Mission"]}, key="photo_id")
                    for generic in html.generic_tokens(row_fields.get("Sample")):
                        self.photo_relationship(generic, entity_id, None, "photo_search", rid, i)
                        self.schedule_sample(generic)
                    for generic, _ in html.linked_ids(parent, "sample", "sampleinfo.cfm"):
                        self.photo_relationship(generic, entity_id, None, "photo_search", rid, i)
                if self.config["mode"] == "full":
                    self.schedule_photo(entity_id, absolute_url(url, a["href"]))
            else:
                self.store.sample_stub(entity_id)
                parent = a.find_parent("tr")
                self.store.observe("sample", entity_id, "html:search_row", html.text(parent), rid, f"result[{i}]")
                self.schedule_sample(entity_id)
        self.store.observe("inventory", context["partition"], kind + ":distinct_count", len({v for v, _ in found}), rid, "all record links in response")

    def run(self, max_requests=100, retry_failed=False, delay=None):
        effective_delay = self.config["delay"] if delay is None else delay
        client = Client(self.store, delay=effective_delay, max_requests=max_requests, user_agent=self.config["user_agent"])
        with self.store.db:
            # Older runs may already have queued a per-record feedback form
            # before `follow` began excluding it. Treat any such request as a
            # deliberate terminal exclusion, never as content to fetch.
            self.store.db.execute("UPDATE requests SET state='parsed',outcome='excluded_interactive_form',error=NULL WHERE state IN ('pending','fetched') AND lower(url) LIKE '%/feedbackform.cfm%'")
            if retry_failed:
                self.store.db.execute("UPDATE requests SET state='pending',error=NULL WHERE state='failed'")
        processed, failures = 0, 0
        while True:
            tasks = self.store.rows("SELECT * FROM requests WHERE state IN ('pending','fetched') ORDER BY priority,rowid LIMIT 1")
            if not tasks:
                break
            task = tasks[0]
            try:
                cached = self.store.rows("SELECT * FROM responses WHERE request_id=? AND outcome='success' ORDER BY fetched_at DESC LIMIT 1", (task["request_id"],))
                response = cached[0] if cached else client.fetch(task)
                with self.store.db:
                    self.parse(task, response)
                    self.store.db.execute("UPDATE requests SET state='parsed',outcome='parsed',error=NULL WHERE request_id=?", (task["request_id"],))
                processed += 1
                failures = 0
                print(f"[{processed}; HTTP {client.count}] {task['kind']} {task['url']}", flush=True)
            except BudgetReached:
                print("Request budget reached; run is resumable.", flush=True)
                break
            except (FetchError, ValueError, KeyError, TypeError) as exc:
                if task["kind"] == "alternate_samples" and str(exc).startswith("not_found: HTTP 404"):
                    with self.store.db:
                        self.store.db.execute("UPDATE requests SET state='parsed',outcome='source_unavailable',error=NULL WHERE request_id=?", (task["request_id"],))
                        self.store.issue("source_unavailable", "request", task["request_id"], "NASA returned HTTP 404 for a documented alternate inventory value", {"url": task["url"]}, disposition="source_unavailable")
                    failures = 0
                    print(f"SOURCE UNAVAILABLE {task['url']}: {exc}", flush=True)
                    continue
                if task["kind"] == "page" and "/images/" in urlsplit(task["url"]).path.lower() and str(exc).startswith("http_error: HTTP 403"):
                    with self.store.db:
                        self.store.db.execute("UPDATE requests SET state='parsed',outcome='source_unavailable',error=NULL WHERE request_id=?", (task["request_id"],))
                        self.store.issue("source_unavailable", "request", task["request_id"], "A linked static-asset directory is not browseable as an HTML page", {"url": task["url"]}, disposition="source_unavailable")
                    failures = 0
                    print(f"SKIPPED ASSET DIRECTORY {task['url']}: {exc}", flush=True)
                    continue
                with self.store.db:
                    self.store.db.execute("UPDATE requests SET state='failed',outcome='error',error=? WHERE request_id=?", (str(exc), task["request_id"]))
                    self.store.issue("acquisition_error", "request", task["request_id"], str(exc), {"url": task["url"]}, severity="error")
                print(f"FAILED {task['url']}: {exc}", flush=True)
                failures += 1
                if failures >= 3 or "resume later" in str(exc) or "HTTP 403" in str(exc):
                    print("Stopping after repeated errors or server denial; inspect report before resuming.", flush=True)
                    break
        states = {r["state"]: r["n"] for r in self.store.rows("SELECT state,COUNT(*) n FROM requests GROUP BY state")}
        state = "paused" if states.get("pending") or states.get("fetched") else "acquisition_errors" if states.get("failed") else "acquisition_finished_needs_review"
        write_json(self.store.root / "progress.json", {"updated_at": utcnow(), "status": state, "requests": states, "http_requests_this_invocation": client.count, "request_delay_seconds": effective_delay, "parser_version": __version__, "content_parity": "not_verified"})
        return state

    def reparse(self):
        self.store.reset_parsing()
        count = 0
        # Preserve acquisition order, because catalog form partitioning depends on mission lookup.
        rows = self.store.rows("SELECT r.* FROM responses r WHERE r.outcome='success' AND r.fetched_at=(SELECT MAX(x.fetched_at) FROM responses x WHERE x.request_id=r.request_id AND x.outcome='success') ORDER BY r.fetched_at")
        for response in rows:
            task = self.store.rows("SELECT * FROM requests WHERE request_id=?", (response["request_id"],))[0]
            try:
                with self.store.db:
                    self.parse(task, response)
                    self.store.db.execute("UPDATE requests SET state='parsed',error=NULL WHERE request_id=?", (task["request_id"],))
                count += 1
            except (ValueError, KeyError, TypeError) as exc:
                with self.store.db:
                    self.store.db.execute("UPDATE requests SET state='failed',error=? WHERE request_id=?", (str(exc), task["request_id"],))
                    self.store.issue("acquisition_error", "request", task["request_id"], str(exc), {"response_id": response["response_id"]}, severity="error")
        states = {r["state"]: r["n"] for r in self.store.rows("SELECT state,COUNT(*) n FROM requests GROUP BY state")}
        state = "paused" if states.get("pending") or states.get("fetched") else "acquisition_errors" if states.get("failed") else "acquisition_finished_needs_review"
        write_json(self.store.root / "progress.json", {"updated_at": utcnow(), "status": state, "requests": states, "last_operation": "offline_reparse", "http_requests_this_invocation": 0, "parser_version": self.store.parser_signature, "content_parity": "not_verified"})
        return count
