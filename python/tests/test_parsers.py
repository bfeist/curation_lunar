import json

import pytest

from lunar_ingest import html
from lunar_ingest.common import asset_kind, identifier
from lunar_ingest.reports import export, file_hash, validate
from conftest import FIXTURES, ingest_fixture


def test_sample_has_all_publications_photos_and_source_precision(setup_pipeline):
    store, pipeline, _ = setup_pipeline
    ingest_fixture(store, pipeline, "api_sample", "sample_detail", {"generic": "63586"})
    ingest_fixture(store, pipeline, "sample_63586", "sample_page", {"generic": "63586"})
    row = store.rows("SELECT * FROM samples WHERE generic='63586'")[0]
    assert row["original_weight_g"] == 1.98
    assert row["pristinity_date"] == "2007-08-15"
    assert row["has_display_sample"] is None
    assert store.db.execute("SELECT COUNT(*) FROM sample_publications").fetchone()[0] == 3
    assert store.db.execute("SELECT COUNT(DISTINCT photo_id) FROM sample_photos").fetchone()[0] == 7
    assert any("63548.pdf" in r["url"] for r in store.rows("SELECT url FROM publications"))
    assert all(not asset_kind(r["url"]) for r in store.rows("SELECT url FROM requests"))


def test_large_gallery_and_references_are_not_limited_to_first_ui_page(setup_pipeline):
    store, pipeline, _ = setup_pipeline
    ingest_fixture(store, pipeline, "sample_67915", "sample_page", {"generic": "67915"})
    assert store.db.execute("SELECT COUNT(*) FROM bibliographic_references").fetchone()[0] == 9
    assert store.db.execute("SELECT COUNT(DISTINCT photo_id) FROM sample_photos").fetchone()[0] > 50
    assert store.db.execute("SELECT COUNT(*) FROM requests WHERE kind='photo_page'").fetchone()[0] == 12


def test_thin_sections_and_two_displays_at_one_location(setup_pipeline):
    store, pipeline, _ = setup_pipeline
    ingest_fixture(store, pipeline, "api_thin", "thin_sections", {"generic": "64476"})
    ingest_fixture(store, pipeline, "api_displays", "displays", {"generic": "67915"})
    assert store.db.execute("SELECT COUNT(*) FROM thin_sections").fetchone()[0] == 5
    assert store.rows("SELECT availability_label FROM thin_sections WHERE specific='31'")[0]["availability_label"] == "On loan"
    assert store.db.execute("SELECT COUNT(*) FROM sample_displays").fetchone()[0] == 2
    assert store.db.execute("SELECT COUNT(*) FROM display_locations").fetchone()[0] == 1
    assert {r["specific"] for r in store.rows("SELECT specific FROM sample_displays")} == {"276", "302"}


def test_photo_preserves_external_tiff_and_specific_zero(setup_pipeline):
    store, pipeline, _ = setup_pipeline
    ingest_fixture(store, pipeline, "photo", "photo_page", {"photo_id": "S72-42069"})
    photo = store.rows("SELECT * FROM photos WHERE photo_id='S72-42069'")[0]
    assert photo["related_specifics_raw"] == "0"
    assert photo["orientation_raw"] == "S1"
    assert any("amazonaws.com" in a["url"] and a["url"].endswith(".TIF") for a in store.rows("SELECT url FROM assets"))
    assert {r["generic"] for r in store.rows("SELECT generic FROM sample_photos")} == {"63586"}


def test_full_browser_form_controls_and_luna_values():
    soup = html.soup_for((FIXTURES / "catalog.html").read_bytes())
    params = html.successful_controls(soup.select_one("#advphotosearch"), {"advgeneric": "63586", "missionOptions": None})
    assert ("advgeneric", "63586") in params
    assert sum(k == "stations" for k, v in params) > 1
    assert any(k == "allLandmarkValues" and "VICTORY CRATER" in v for k, v in params)
    assert not any(k == "missionOptions" for k, v in params)


def test_api_lookup_and_page_content_inventory(setup_pipeline):
    store, pipeline, _ = setup_pipeline
    ingest_fixture(store, pipeline, "missions", "missions")
    ingest_fixture(store, pipeline, "home", "page")
    ingest_fixture(store, pipeline, "catalog", "catalog")
    assert store.db.execute("SELECT COUNT(*) FROM missions").fetchone()[0] == 9
    assert store.db.execute("SELECT COUNT(*) FROM requests WHERE kind='sample_results'").fetchone()[0] == 9
    assert store.db.execute("SELECT COUNT(*) FROM content_blocks").fetchone()[0] > 5
    assert store.db.execute("SELECT COUNT(*) FROM content_requirements").fetchone()[0] > 15


def test_idempotent_parse_and_offline_rebuild(setup_pipeline):
    store, pipeline, config = setup_pipeline
    task, response = ingest_fixture(store, pipeline, "api_thin", "thin_sections", {"generic": "64476"})
    pipeline.parse(task, response)
    store.db.commit()
    before = [dict(r) for r in store.db.execute("SELECT * FROM thin_sections ORDER BY id")]
    pipeline.reparse()
    assert store.rows("SELECT * FROM thin_sections ORDER BY id") == before
    report = validate(store, config)
    assert report["unresolved_errors"] == 0
    target = export(store, config)
    assert (target / "lunar.sqlite").exists()
    assert (target / "csv/thin_sections.csv").exists()


@pytest.mark.parametrize("value,expected", [(67915.0, "67915"), ("00001", "00001"), (0, "0"), (None, None)])
def test_identifiers(value, expected):
    assert identifier(value) == expected


def test_non_integral_identifiers_and_application_errors():
    with pytest.raises(ValueError):
        identifier(67915.5)
    assert html.app_error(html.soup_for(b"<title>Error</title>An error occurred while executing the application."))
    assert not html.app_error(html.soup_for((FIXTURES / "sample_67915.html").read_bytes()))


def test_schema_unknown_fields_survive_and_outlier_is_retained(setup_pipeline):
    store, pipeline, config = setup_pipeline
    _, response = ingest_fixture(store, pipeline, "api_sample", "sample_detail", {"generic": "63586"})
    row = json.loads((FIXTURES / "api_sample.json").read_text())[0]
    row.update({"PRISTINITY": 112.5, "FUTURE_FIELD": {"nested": "preserved"}})
    with store.db:
        pipeline.sample_record(row, response["response_id"], "$[0]")
    validate(store, config)
    assert store.rows("SELECT pristine_percent FROM samples")[0]["pristine_percent"] == 112.5
    assert store.rows("SELECT raw_json FROM field_observations WHERE field='FUTURE_FIELD'")[0]["raw_json"] == '{"nested":"preserved"}'
    assert store.rows("SELECT * FROM validation_issues WHERE category='numeric_outlier'")


def test_search_states_empty_results_and_explicit_photo_associations(setup_pipeline):
    store, pipeline, _ = setup_pipeline
    ingest_fixture(store, pipeline, "photo_search_63586", "photo_results", {"partition": "sample:63586"})
    ingest_fixture(store, pipeline, "photo_search_empty", "photo_results", {"partition": "sample:21000"})
    assert store.db.execute("SELECT COUNT(*) FROM pages WHERE page_type='photo_results'").fetchone()[0] == 2
    assert not store.rows("SELECT * FROM validation_issues WHERE category='result_exhaustion'")
    assert store.db.execute("SELECT COUNT(*) FROM sample_photos WHERE relationship_source='photo_search'").fetchone()[0] == 7
    assert store.rows("SELECT mission_raw FROM photos WHERE photo_id='S72-42069'")[0]["mission_raw"] == "Apollo 16"


def test_search_bugs_do_not_remove_api_records_and_precision_is_retained(setup_pipeline):
    from lunar_ingest.reports import source_differences
    store, pipeline, _ = setup_pipeline
    ingest_fixture(store, pipeline, "missions", "missions")
    ingest_fixture(store, pipeline, "api_apollo11", "mission_samples", {"mission": "Apollo 11"})
    ingest_fixture(store, pipeline, "api_luna16", "mission_samples", {"mission": "Luna 16"})
    ingest_fixture(store, pipeline, "search_apollo11", "sample_results", {"mission": "Apollo 11", "partition": "Apollo 11"})
    assert store.db.execute("SELECT COUNT(*) FROM samples WHERE mission='Apollo 11'").fetchone()[0] == 80
    differences = source_differences(store)
    assert len(differences) == 13
    assert all(r["disposition"] == "legacy_search_bug_pending_original_source_audit" for r in differences)
    assert store.rows("SELECT original_weight_g FROM samples WHERE generic='21000'")[0]["original_weight_g"] == 0.593


def test_full_mode_schedules_independent_inventories(setup_pipeline):
    store, pipeline, config = setup_pipeline
    config["mode"] = "full"
    ingest_fixture(store, pipeline, "missions", "missions")
    ingest_fixture(store, pipeline, "catalog", "catalog")
    tasks = store.rows("SELECT context_json FROM requests WHERE kind='photo_results'")
    assert {json.loads(r["context_json"])["partition"] for r in tasks} == {"ALL", "Apollo 11", "Apollo 12", "Apollo 14", "Apollo 15", "Apollo 16", "Apollo 17", "Luna 16", "Luna 20", "Luna 24"}
    pipeline.alternate_inventory({"endpoint": "listsampleclassification"}, {"SAMPLETYPE": "Soil", "SAMPLESUBTYPE": "<1 mm"})
    assert store.rows("SELECT url FROM requests WHERE kind='alternate_samples'")


def test_bibliography_search_keeps_citations_and_popup_relationships(setup_pipeline):
    store, pipeline, _ = setup_pipeline
    ingest_fixture(store, pipeline, "reference_search", "reference_results", {"partition": "67915"})
    assert store.db.execute("SELECT COUNT(*) FROM bibliographic_references").fetchone()[0] == 9
    assert store.db.execute("SELECT COUNT(*) FROM requests WHERE kind='reference_samples'").fetchone()[0] == 2
    assert store.db.execute("SELECT COUNT(*) FROM sample_references WHERE generic='67915'").fetchone()[0] == 7
    assert not any("type=xcel" in r["url"] for r in store.rows("SELECT url FROM requests"))
