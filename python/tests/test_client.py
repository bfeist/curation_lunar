import pytest

from lunar_ingest.client import BudgetReached, Client, FetchError


class Response:
    def __init__(self, content_type, status=200, location=None):
        self.status_code = status
        self.headers = {"Content-Type": content_type}
        if location:
            self.headers["Location"] = location
        self.url = "https://curator.jsc.nasa.gov/lunar/test.cfm"
        self.read = False

    def iter_content(self, size):
        self.read = True
        yield b"<html>test</html>"

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def task(store):
    rid = store.enqueue("https://curator.jsc.nasa.gov/lunar/test.cfm", "page")
    store.db.commit()
    return store.rows("SELECT * FROM requests WHERE request_id=?", (rid,))[0]


def test_assets_are_never_requested_or_read(setup_pipeline, monkeypatch):
    store, _, _ = setup_pipeline
    client = Client(store, delay=0)
    with pytest.raises(FetchError):
        client._send("GET", "https://curator.jsc.nasa.gov/a.PDF", [])
    response = Response("application/pdf")
    monkeypatch.setattr(client.session, "request", lambda *args, **kwargs: response)
    with pytest.raises(FetchError):
        client.fetch(task(store))
    assert not response.read
    assert store.rows("SELECT body_path FROM responses")[0]["body_path"] is None


def test_redirect_to_asset_is_not_followed(setup_pipeline, monkeypatch):
    store, _, _ = setup_pipeline
    client = Client(store, delay=0)
    response = Response("text/html", 302, "/lunar/large.tif")
    monkeypatch.setattr(client.session, "request", lambda *args, **kwargs: response)
    with pytest.raises(FetchError):
        client.fetch(task(store))
    assert client.count == 1


def test_request_budget_leaves_task_resumable(setup_pipeline, monkeypatch):
    store, _, _ = setup_pipeline
    client = Client(store, delay=0, max_requests=1)
    client.count = 1
    with pytest.raises(BudgetReached):
        client.fetch(task(store))
    assert store.rows("SELECT state FROM requests")[0]["state"] == "pending"


def test_post_cache_keys_preserve_repeated_fields(setup_pipeline):
    store, _, _ = setup_pipeline
    a = store.enqueue("https://curator.jsc.nasa.gov/lunar/test.cfm", "page", params=[("mission", "Apollo 11"), ("station", ""), ("station", "LM")])
    b = store.enqueue("https://curator.jsc.nasa.gov/lunar/test.cfm", "page", params=[("mission", "Apollo 12"), ("station", ""), ("station", "LM")])
    assert a != b
