import csv
import hashlib
import json
import sqlite3
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path

from . import __version__, code_fingerprint
from .common import json_text, utcnow
from .storage import write_json


def csv_value(value):
    if value is None:
        return "\\N"
    if isinstance(value, (dict, list)):
        return json_text(value)
    # Prefix every literal backslash with another, making NULL unambiguous.
    return str(value).replace("\\", "\\\\")


def write_csv(path, rows, columns=None):
    rows = list(rows)
    columns = columns or (list(rows[0]) if rows else [])
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(columns)
        for row in rows:
            writer.writerow([csv_value(row.get(c)) for c in columns])


def source_differences(store):
    differences = []
    for row in store.rows("SELECT name FROM missions ORDER BY name"):
        mission = row["name"]
        api = {r["entity_id"] for r in store.rows("SELECT entity_id FROM discovery_memberships WHERE entity_type='sample' AND surface='api_mission' AND partition_key=?", (mission,))}
        web = {r["entity_id"] for r in store.rows("SELECT entity_id FROM discovery_memberships WHERE entity_type='sample' AND surface='html_mission' AND partition_key=?", (mission,))}
        # Only compare inventories whose requests actually parsed successfully.
        checked = store.rows("SELECT context_json FROM requests WHERE kind='sample_results' AND state='parsed'")
        if not any(json.loads(r["context_json"]).get("mission") == mission for r in checked):
            continue
        for generic in sorted(api ^ web):
            differences.append({"mission": mission, "generic": generic, "difference": "api_only" if generic in api else "html_only", "disposition": "legacy_search_bug_pending_original_source_audit"})
    return differences


def validate(store, config):
    with store.db:
        store.db.execute("DELETE FROM validation_issues WHERE category IN ('numeric_outlier','foreign_key','field_conflict','flag_conflict','missing_date','schema_unknown','raw_integrity','duplicate_specific')")
        for row in store.rows("PRAGMA foreign_key_check"):
            store.issue("foreign_key", "database", str(row), "Foreign-key violation", row, severity="error")
        checked_generics = {kind: {json.loads(t["context_json"]).get("generic") for t in store.rows("SELECT context_json FROM requests WHERE kind=? AND state='parsed'", (kind,))} for kind in ("thin_sections", "displays")}
        for row in store.rows("SELECT generic,original_weight_g,pristine_percent,pristinity_date_raw,pristinity_date,has_thin_section,has_display_sample FROM samples"):
            g = row["generic"]
            for field in ("original_weight_g", "pristine_percent"):
                value = row[field]
                if value is not None and (value < 0 or (field == "pristine_percent" and value > 100)):
                    store.issue("numeric_outlier", "sample", g, f"Source value outside expected range: {field}={value}", row, disposition="preserved_source_value")
            if row["pristinity_date_raw"] and not row["pristinity_date"]:
                store.issue("missing_date", "sample", g, "Unparsed source date retained", row)
            for flag, kind, table in [("has_thin_section", "thin_sections", "thin_sections"), ("has_display_sample", "displays", "sample_displays")]:
                if g in checked_generics[kind]:
                    count = store.db.execute(f"SELECT COUNT(*) FROM {table} WHERE generic=?", (g,)).fetchone()[0]
                    if row[flag] is not None and bool(row[flag]) != bool(count):
                        store.issue("flag_conflict", "sample", g, f"{flag} disagrees with {kind} records", {"flag": row[flag], "count": count}, disposition="preserved_source_value")
        for row in store.rows("SELECT generic,specific,COUNT(*) n FROM thin_sections GROUP BY generic,specific HAVING COUNT(*)>1"):
            store.issue("duplicate_specific", "sample", row["generic"], "Conflicting thin-section records share a generic/specific; all distinct source rows retained", row)
        fields = {"Original Weight": "original_weight_g", "Percent of Pristine Sample Available": "pristine_percent", "Mission": "mission", "Station": "station_raw", "Landmark": "landmark_raw", "Bag Number": "bag_number", "Rock Type": "sample_type", "Rock Subtype": "sample_subtype", "Description": "description"}
        for label, column in fields.items():
            observations = store.rows(f"SELECT o.entity_id,o.raw_json,o.response_id,s.{column} value FROM field_observations o JOIN samples s ON s.generic=o.entity_id WHERE o.entity_type='sample' AND o.field=?", ("html:" + label,))
            for observation in observations:
                displayed, value = json.loads(observation["raw_json"]), observation["value"]
                if column in {"original_weight_g", "pristine_percent"}:
                    try:
                        shown = Decimal(displayed.strip().removesuffix("g").removesuffix("%").strip())
                        equal = value is not None and abs(Decimal(str(value)) - shown) <= Decimal(5).scaleb(shown.as_tuple().exponent - 1)
                    except InvalidOperation:
                        equal = value is None and not displayed
                else:
                    equal = str(value or "").strip() == str(displayed or "").strip()
                if not equal:
                    store.issue("field_conflict", "sample", observation["entity_id"], f"API/HTML disagreement: {label}", observation, disposition="preserve_both_audit_later")
        for response in store.rows("SELECT response_id,body_path,sha256 FROM responses WHERE body_path IS NOT NULL"):
            path = store.root / response["body_path"]
            if not path.exists() or file_hash(path) != response["sha256"]:
                store.issue("raw_integrity", "response", response["response_id"], "Raw evidence missing or hash mismatch", response, severity="error")
        # A recovered request no longer counts as an unresolved acquisition error.
        store.db.execute("UPDATE validation_issues SET disposition='resolved' WHERE category='acquisition_error' AND entity_id IN (SELECT request_id FROM requests WHERE state='parsed')")
        for request in store.rows("SELECT request_id,url FROM requests WHERE outcome='source_unavailable'"):
            store.issue("source_unavailable", "request", request["request_id"], "NASA returned no public response for this discovered target", {"url": request["url"]}, disposition="source_unavailable")

    tables = [r["name"] for r in store.rows("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    totals = {t: store.db.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in tables}
    states = store.rows("SELECT kind,state,COUNT(*) count FROM requests GROUP BY kind,state ORDER BY kind,state")
    samples = store.rows("SELECT mission,COUNT(*) count,SUM(record_status LIKE '%html%') with_html FROM samples GROUP BY mission ORDER BY mission")
    differences = source_differences(store)
    pending = store.db.execute("SELECT COUNT(*) FROM requests WHERE state<>'parsed'").fetchone()[0]
    errors = store.db.execute("SELECT COUNT(*) FROM validation_issues WHERE severity='error' AND disposition='open'").fetchone()[0]
    report = {"generated_at": utcnow(), "mode": config["mode"], "model": "reverse_engineered_current_public_view", "parser_version": __version__, "content_parity": "not_verified", "acquisition_queue_finished": pending == 0, "unresolved_errors": errors, "totals": totals, "requests_by_kind_and_state": states, "samples_by_mission": samples, "search_discrepancies": len(differences), "limitations": ["Pilot mode intentionally limits sample, photo and informational-page acquisition." if config["mode"] == "pilot" else "Full mode follows public inventories; a manual route, pagination and rendered-content audit is still required.", "No original historical schema or private inventory is inferred.", "Media/PDF bodies are not downloaded; asset accessibility and rendering remain frontend acceptance work.", "Dynamic content, publication table semantics and unknown HTML fields remain preserved as source HTML/structured tables pending review.", "API/search membership discrepancies are treated as legacy search bugs, not suppression rules for the replacement."]}
    reports = store.root / "reports"
    write_json(reports / "coverage.json", report)
    write_csv(reports / "content-parity.csv", store.rows("SELECT * FROM content_requirements ORDER BY source_url,section"))
    write_csv(reports / "source-differences.csv", differences, ["mission", "generic", "difference", "disposition"])
    write_csv(reports / "validation-issues.csv", store.rows("SELECT * FROM validation_issues ORDER BY severity,category,entity_id"))
    write_csv(reports / "field-coverage.csv", store.rows("SELECT entity_type,field,COUNT(*) observations,COUNT(DISTINCT entity_id) entities,SUM(raw_json='null') nulls FROM field_observations GROUP BY entity_type,field ORDER BY entity_type,field"))
    write_csv(reports / "asset-links.csv", store.rows("SELECT a.url,a.kind,o.page_url,o.role,o.label,o.alt_text FROM assets a JOIN asset_occurrences o ON o.asset_url=a.url ORDER BY a.url,o.page_url"))
    lines = ["# Public website acquisition report", "", f"Generated: {report['generated_at']}", f"Mode: **{config['mode']}**. Content parity: **not yet verified**.", "", f"Samples: **{totals['samples']}**; photo IDs: **{totals['photos']}**; parsed pages: **{totals['pages']}**; remote asset URLs: **{totals['assets']}**.", f"Unfinished/failed requests: **{pending}**; unresolved errors: **{errors}**.", f"API/search membership differences: **{len(differences)}**, retained as legacy search bugs for a later original-source audit.", "", "## Mission inventory", "", "| Mission | Samples retained | With sample HTML |", "| --- | ---: | ---: |"]
    lines.extend(f"| {r['mission'] or '(unassigned)'} | {r['count']} | {r['with_html'] or 0} |" for r in samples)
    lines += ["", "## Request states", "", "| Kind | State | Count |", "| --- | --- | ---: |"]
    lines.extend(f"| {r['kind']} | {r['state']} | {r['count']} |" for r in states)
    lines += ["", "## Limits and remaining review", ""] + ["- " + s for s in report["limitations"]]
    (reports / "coverage.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    gaps = store.rows("SELECT source_url,section,acquisition_status FROM content_requirements WHERE acquisition_status<>'acquired_unreviewed' ORDER BY source_url")
    (reports / "content-gaps.md").write_text("# Content acquisition gaps\n\nAll content requirements still require manual presentation review.\n\n" + "\n".join(f"- {r['source_url']} — {r['section']}: {r['acquisition_status']}" for r in gaps) + "\n", encoding="utf-8")
    return report


def file_hash(path):
    result = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def export(store, config):
    report = validate(store, config)
    target = store.root / "exports"
    target.mkdir(parents=True, exist_ok=True)
    table_names = [r["name"] for r in store.rows("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    fingerprints = {}
    schema = {}
    for table in table_names:
        columns = store.rows(f'PRAGMA table_info("{table}")')
        schema[table] = columns
        # Sorting by all columns makes cache rebuild comparisons independent of insertion order.
        names = [r["name"] for r in columns]
        order = ",".join(f'"{n}"' for n in names)
        rows = store.rows(f'SELECT * FROM "{table}" ORDER BY {order}')
        path = target / "csv" / f"{table}.csv"
        write_csv(path, rows, names)
        fingerprints[str(path.relative_to(target))] = file_hash(path)
    snapshot = target / "lunar.sqlite"
    temporary = target / "lunar.sqlite.tmp"
    connection = sqlite3.connect(temporary)
    try:
        store.db.backup(connection)
    finally:
        connection.close()
    temporary.replace(snapshot)
    fingerprints["lunar.sqlite"] = file_hash(snapshot)
    write_json(target / "data-dictionary.json", {"model": "current public view, subject to future migrations", "tables": schema, "csv_null": "\\N", "csv_escape": "literal backslashes are doubled; reverse escaping after checking NULL", "identifiers": "Treat generic, specific and photo identifiers as text.", "html": "Source HTML is untrusted evidence; sanitize before rendering in a frontend."})
    manifest = {"created_at": utcnow(), "config": config, "schema_migrations": store.rows("SELECT * FROM schema_migrations ORDER BY version"), "parser_version": __version__, "coverage": report, "sha256": fingerprints, "release_status": "candidate_requires_content_review"}
    manifest["parser_code_sha256"] = code_fingerprint()
    write_json(target / "manifest.json", manifest)
    return target
