import json
import sqlite3
from importlib.resources import files
from pathlib import Path

from . import __version__, code_fingerprint
from .common import digest, json_text, request_url, utcnow


class Store:
    def __init__(self, run_dir):
        self.parser_signature = __version__ + ":" + code_fingerprint()[:16]
        self.root = Path(run_dir)
        self.root.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.root / "lunar.sqlite")
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL)")
        self.db.commit()
        migrations = sorted(files("lunar_ingest").joinpath("migrations").iterdir(), key=lambda p: p.name)
        for migration in migrations:
            if not migration.name.endswith(".sql"):
                continue
            sql = migration.read_text(encoding="utf-8")
            checksum = digest(sql.encode("utf-8"))
            old = self.db.execute("SELECT sha256 FROM schema_migrations WHERE version=?", (migration.name,)).fetchone()
            if old:
                if old[0] != checksum:
                    self.db.close()
                    raise RuntimeError(f"Applied migration changed: {migration.name}; add a new migration instead")
                continue
            try:
                self.db.executescript("BEGIN IMMEDIATE;\n" + sql)
                self.db.execute("INSERT INTO schema_migrations VALUES (?,?,?)", (migration.name, checksum, utcnow()))
                self.db.commit()
            except Exception:
                self.db.rollback()
                raise

    def close(self):
        self.db.close()

    def upsert(self, table, values, key="id"):
        # Table/column names come only from internal parser code.
        cols = list(values)
        updates = ",".join(f'"{c}"=excluded."{c}"' for c in cols if c != key)
        sql = f'INSERT INTO "{table}" ({",".join(cols)}) VALUES ({",".join("?" for _ in cols)}) ON CONFLICT("{key}") DO '
        sql += "UPDATE SET " + updates if updates else "NOTHING"
        self.db.execute(sql, tuple(values[c] for c in cols))

    def enqueue(self, url, kind, context=None, params=None, priority=50):
        url = request_url(url)
        params = list(params or [])
        method = "POST" if params else "GET"
        key = digest([method, url, params])
        self.db.execute("INSERT OR IGNORE INTO requests(request_id,method,url,params_json,kind,context_json,priority) VALUES(?,?,?,?,?,?,?)", (key, method, url, json_text(params), kind, json_text(context or {}), priority))
        return key

    def sample_stub(self, generic):
        if generic:
            self.db.execute("INSERT OR IGNORE INTO samples(generic) VALUES(?)", (generic,))

    def photo_stub(self, photo_id):
        self.db.execute("INSERT OR IGNORE INTO photos(photo_id) VALUES(?)", (photo_id,))

    def evidence(self, entity_type, entity_id, response_id, locator):
        self.upsert("record_evidence", {"id": digest([entity_type, entity_id, response_id, locator]), "entity_type": entity_type, "entity_id": entity_id, "response_id": response_id, "source_locator": locator, "parser_version": self.parser_signature})

    def observe(self, entity_type, entity_id, field, raw, response_id, locator):
        self.upsert("field_observations", {"id": digest([entity_type, entity_id, field, response_id, locator]), "entity_type": entity_type, "entity_id": entity_id, "field": field, "raw_json": json_text(raw), "response_id": response_id, "source_locator": locator})

    def member(self, entity_type, entity_id, surface, partition, response_id):
        self.upsert("discovery_memberships", {"id": digest([entity_type, entity_id, surface, partition, response_id]), "entity_type": entity_type, "entity_id": entity_id, "surface": surface, "partition_key": partition, "response_id": response_id})

    def issue(self, category, entity_type, entity_id, message, evidence=None, severity="warning", disposition="open"):
        self.upsert("validation_issues", {"id": digest([category, entity_type, entity_id, message]), "severity": severity, "category": category, "entity_type": entity_type, "entity_id": entity_id, "message": message, "evidence_json": json_text(evidence or {}), "disposition": disposition})

    def requirement(self, url, section, kind, mapping=None, status="discovered", evidence=None):
        values = {"id": digest([url, section, kind]), "source_url": url, "section": section, "kind": kind, "mapping": mapping, "acquisition_status": status, "evidence": evidence}
        old = self.db.execute("SELECT acquisition_status FROM content_requirements WHERE id=?", (values["id"],)).fetchone()
        if old and old[0] == "acquired_unreviewed" and status == "discovered":
            return
        self.upsert("content_requirements", values)

    def rows(self, sql, params=()):
        return [dict(row) for row in self.db.execute(sql, params)]

    def reset_parsing(self):
        """Rebuild derived data from immutable responses; preserve migration/request history."""
        tables = ["record_evidence", "field_observations", "discovery_memberships", "content_requirements", "validation_issues", "content_blocks", "page_links", "asset_occurrences", "sample_photos", "sample_publications", "sample_references", "sample_displays", "thin_sections", "pages", "assets", "bibliographic_references", "publications", "photos", "display_locations", "samples", "missions", "vocabulary_values"]
        with self.db:
            for table in tables:
                self.db.execute(f'DELETE FROM "{table}"')
            self.db.execute("UPDATE requests SET state='fetched',error=NULL WHERE request_id IN (SELECT request_id FROM responses WHERE outcome='success')")


def read_config(root):
    return json.loads((Path(root) / "run.json").read_text(encoding="utf-8"))


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)
