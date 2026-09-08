from pathlib import Path

import pytest

import lunar_ingest.storage as storage
from lunar_ingest.reports import csv_value


def test_new_migration_preserves_existing_data_and_old_migration_is_immutable(tmp_path, monkeypatch):
    migrations = tmp_path / "package" / "migrations"
    migrations.mkdir(parents=True)
    source = Path(storage.__file__).parent / "migrations" / "001_public_view.sql"
    initial = source.read_text(encoding="utf-8")
    (migrations / source.name).write_text(initial, encoding="utf-8")
    monkeypatch.setattr(storage, "files", lambda _: migrations.parent)
    store = storage.Store(tmp_path / "run")
    with store.db:
        store.sample_stub("00001")
    store.close()
    (migrations / "002_example.sql").write_text("ALTER TABLE samples ADD COLUMN original_system_id TEXT;", encoding="utf-8")
    store = storage.Store(tmp_path / "run")
    assert store.rows("SELECT generic,original_system_id FROM samples") == [{"generic": "00001", "original_system_id": None}]
    assert len(store.rows("SELECT * FROM schema_migrations")) == 2
    store.close()
    (migrations / source.name).write_text(initial + "\n-- edited after application\n", encoding="utf-8")
    with pytest.raises(RuntimeError, match="Applied migration changed"):
        storage.Store(tmp_path / "run")


def test_csv_null_and_literal_backslash_are_distinguishable():
    assert csv_value(None) == "\\N"
    assert csv_value("\\N") == "\\\\N"
    assert csv_value("") == ""


def test_acquired_requirement_is_not_downgraded_by_rediscovery(setup_pipeline):
    store, _, _ = setup_pipeline
    store.requirement("https://example.org/page", "Page", "page", mapping="pages:x", status="acquired_unreviewed", evidence="evidence")
    store.requirement("https://example.org/page", "Page", "page")
    assert store.rows("SELECT acquisition_status,mapping FROM content_requirements")[0] == {"acquisition_status": "acquired_unreviewed", "mapping": "pages:x"}
