import json
from pathlib import Path

import pytest

from lunar_ingest.common import digest, json_text, utcnow
from lunar_ingest.pipeline import Pipeline
from lunar_ingest.storage import Store

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def setup_pipeline(tmp_path):
    store = Store(tmp_path / "run")
    config = {"mode": "pilot", "samples": ["63586", "64476", "67915", "21000", "10006", "10070"], "photo_limit": 12, "page_limit": 25, "delay": 0, "user_agent": "test"}
    pipeline = Pipeline(store, config)
    yield store, pipeline, config
    store.close()


def ingest_fixture(store, pipeline, name, kind, context=None):
    source = json.loads((FIXTURES / "sources.json").read_text(encoding="utf-8"))[name]
    body = (FIXTURES / source["file"]).read_bytes()
    with store.db:
        request_id = store.enqueue(source["url"], kind, context, params=source.get("params"))
        response_id = digest([name, body.hex()])
        path = "raw/" + source["file"]
        (store.root / "raw").mkdir(exist_ok=True)
        (store.root / path).write_bytes(body)
        store.upsert("responses", {"response_id": response_id, "request_id": request_id, "fetched_at": utcnow(), "final_url": source["url"], "status": 200, "body_path": path, "sha256": digest(body), "outcome": "success", "content_type": "application/json" if source["file"].endswith("json") else "text/html"}, key="response_id")
        task = store.rows("SELECT * FROM requests WHERE request_id=?", (request_id,))[0]
        response = store.rows("SELECT * FROM responses WHERE response_id=?", (response_id,))[0]
        pipeline.parse(task, response)
        store.db.execute("UPDATE requests SET state='parsed' WHERE request_id=?", (request_id,))
    return task, response
