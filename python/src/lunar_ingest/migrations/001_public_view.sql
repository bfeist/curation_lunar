-- This models observed public content, not the historical NASA database.
CREATE TABLE requests (
 request_id TEXT PRIMARY KEY, method TEXT NOT NULL, url TEXT NOT NULL,
 params_json TEXT NOT NULL, kind TEXT NOT NULL, context_json TEXT NOT NULL,
 priority INTEGER NOT NULL DEFAULT 50, state TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0, outcome TEXT, error TEXT
);
CREATE TABLE responses (
 response_id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests,
 fetched_at TEXT NOT NULL, final_url TEXT NOT NULL, status INTEGER NOT NULL,
 content_type TEXT, headers_json TEXT, body_path TEXT, sha256 TEXT,
 outcome TEXT NOT NULL
);
CREATE TABLE missions (name TEXT PRIMARY KEY, source_json TEXT NOT NULL);
CREATE TABLE samples (
 generic TEXT PRIMARY KEY, source_sample_id INTEGER, mission TEXT,
 station_raw TEXT, landmark_raw TEXT, bag_number TEXT,
 original_weight_g REAL, sample_type TEXT, sample_subtype TEXT,
 pristine_percent REAL, pristinity_date_raw TEXT, pristinity_date TEXT,
 has_thin_section INTEGER, has_display_sample INTEGER,
 display_sample_number_raw TEXT, description TEXT, detail_url TEXT,
 record_status TEXT NOT NULL DEFAULT 'stub', source_json TEXT
);
CREATE TABLE vocabulary_values (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, mission TEXT,
 value_json TEXT NOT NULL, response_id TEXT REFERENCES responses
);
CREATE TABLE thin_sections (
 id TEXT PRIMARY KEY, generic TEXT NOT NULL REFERENCES samples,
 specific TEXT, weight_g REAL, description TEXT,
 availability_code TEXT, availability_label TEXT, source_json TEXT NOT NULL
);
CREATE TABLE display_locations (
 id TEXT PRIMARY KEY, source_location_id TEXT, name TEXT, url TEXT,
 region TEXT, address_line1 TEXT, address_line2 TEXT, address_line3 TEXT,
 phone TEXT, city TEXT, state TEXT, country TEXT, country_id TEXT,
 latitude REAL, longitude REAL, zoom_level INTEGER, source_json TEXT NOT NULL
);
CREATE TABLE sample_displays (
 id TEXT PRIMARY KEY, generic TEXT NOT NULL REFERENCES samples, specific TEXT,
 location_id TEXT REFERENCES display_locations, description TEXT, source_json TEXT NOT NULL
);
CREATE TABLE photos (
 photo_id TEXT PRIMARY KEY, detail_url TEXT, mission_raw TEXT,
 photo_type TEXT, photo_subtype TEXT, film_type TEXT, description TEXT,
 angle_raw TEXT, orientation_raw TEXT, related_specifics_raw TEXT,
 fields_json TEXT, record_status TEXT NOT NULL DEFAULT 'stub'
);
CREATE TABLE sample_photos (
 id TEXT PRIMARY KEY, generic TEXT NOT NULL REFERENCES samples,
 photo_id TEXT NOT NULL REFERENCES photos, specifics_raw TEXT,
 relationship_source TEXT, response_id TEXT REFERENCES responses, ordinal INTEGER
);
CREATE TABLE publications (
 id TEXT PRIMARY KEY, title TEXT, url TEXT, metadata_json TEXT
);
CREATE TABLE sample_publications (
 id TEXT PRIMARY KEY, generic TEXT NOT NULL REFERENCES samples,
 publication_id TEXT NOT NULL REFERENCES publications,
 label TEXT, response_id TEXT REFERENCES responses, ordinal INTEGER
);
CREATE TABLE bibliographic_references (
 id TEXT PRIMARY KEY, authors_raw TEXT, year TEXT, title TEXT,
 citation_text TEXT, citation_html TEXT, links_json TEXT
);
CREATE TABLE sample_references (
 id TEXT PRIMARY KEY, generic TEXT NOT NULL REFERENCES samples,
 reference_id TEXT NOT NULL REFERENCES bibliographic_references,
 response_id TEXT REFERENCES responses, ordinal INTEGER
);
CREATE TABLE pages (
 url TEXT PRIMARY KEY, page_type TEXT, title TEXT, main_text TEXT,
 main_html TEXT, fields_json TEXT, forms_json TEXT, tables_json TEXT,
 response_id TEXT REFERENCES responses
);
CREATE TABLE content_blocks (
 id TEXT PRIMARY KEY, page_url TEXT NOT NULL REFERENCES pages,
 ordinal INTEGER, kind TEXT, content_json TEXT, response_id TEXT REFERENCES responses
);
CREATE TABLE page_links (
 id TEXT PRIMARY KEY, page_url TEXT NOT NULL REFERENCES pages,
 original_href TEXT, target_url TEXT, label TEXT, role TEXT, ordinal INTEGER,
 response_id TEXT REFERENCES responses
);
CREATE TABLE assets (
 url TEXT PRIMARY KEY, kind TEXT NOT NULL
);
CREATE TABLE asset_occurrences (
 id TEXT PRIMARY KEY, asset_url TEXT NOT NULL REFERENCES assets,
 page_url TEXT REFERENCES pages, original_url TEXT, role TEXT,
 label TEXT, alt_text TEXT, ordinal INTEGER, response_id TEXT REFERENCES responses
);
CREATE TABLE discovery_memberships (
 id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
 surface TEXT NOT NULL, partition_key TEXT NOT NULL,
 response_id TEXT REFERENCES responses
);
CREATE TABLE field_observations (
 id TEXT PRIMARY KEY, entity_type TEXT, entity_id TEXT,
 field TEXT, raw_json TEXT, source_locator TEXT, response_id TEXT REFERENCES responses
);
CREATE TABLE record_evidence (
 id TEXT PRIMARY KEY, entity_type TEXT, entity_id TEXT,
 source_locator TEXT, response_id TEXT REFERENCES responses, parser_version TEXT
);
CREATE TABLE content_requirements (
 id TEXT PRIMARY KEY, source_url TEXT, section TEXT, kind TEXT,
 mapping TEXT, acquisition_status TEXT, review_status TEXT NOT NULL DEFAULT 'unreviewed',
 target_route TEXT, evidence TEXT
);
CREATE TABLE validation_issues (
 id TEXT PRIMARY KEY, severity TEXT, category TEXT, entity_type TEXT,
 entity_id TEXT, message TEXT, evidence_json TEXT, disposition TEXT
);
CREATE INDEX request_queue ON requests(state, priority);
CREATE INDEX membership_entities ON discovery_memberships(entity_type, entity_id);
CREATE INDEX observations_entities ON field_observations(entity_type, entity_id);
CREATE INDEX evidence_entities ON record_evidence(entity_type, entity_id);
