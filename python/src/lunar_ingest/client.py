import email.utils
import json
import random
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit

import requests

from .common import asset_kind, digest, json_text, request_url, utcnow


class BudgetReached(Exception):
    pass


class FetchError(Exception):
    pass


class Client:
    """Sequential, rate-limited text-only client. Never reads an asset response body."""

    def __init__(self, store, delay=1.0, max_requests=100, retries=3, user_agent=None):
        self.store = store
        self.delay = delay
        self.max_requests = max_requests
        self.retries = retries
        self.count = 0
        self.last_request = 0.0
        self.session = requests.Session()
        self.session.headers["User-Agent"] = user_agent or "LunarPublicViewResearch/0.1 (metadata acquisition; sequential requests)"
        self.session.headers["Accept"] = "application/json, text/html;q=0.9, text/plain;q=0.5"

    def _send(self, method, url, params):
        if self.max_requests and self.count >= self.max_requests:
            raise BudgetReached()
        if asset_kind(url):
            raise FetchError(f"Asset request refused: {url}")
        if urlsplit(url).hostname != "curator.jsc.nasa.gov":
            raise FetchError(f"External crawl refused: {url}")
        time.sleep(max(0, self.delay - (time.monotonic() - self.last_request)))
        self.last_request = time.monotonic()
        self.count += 1
        return self.session.request(method, url, data=params if method == "POST" else None, timeout=(15, 90), stream=True, allow_redirects=False)

    def fetch(self, task):
        params = json.loads(task["params_json"])
        request_id = task["request_id"]
        last_error = None
        for attempt in range(self.retries):
            try:
                with self.store.db:
                    self.store.db.execute("UPDATE requests SET attempts=attempts+1 WHERE request_id=?", (request_id,))
                url, method = task["url"], task["method"]
                for redirect in range(6):
                    response = self._send(method, url, params)
                    if response.status_code in (301, 302, 303, 307, 308):
                        location = response.headers.get("Location")
                        status = response.status_code
                        response.close()
                        if not location:
                            raise FetchError("Redirect without Location")
                        from urllib.parse import urljoin
                        url = request_url(urljoin(url, location))
                        if status in (301, 302, 303):
                            method = "GET"
                        continue
                    break
                else:
                    raise FetchError("Too many redirects")
                with response:
                    content_type = response.headers.get("Content-Type", "").lower()
                    allowed = any(t in content_type for t in ("text/html", "application/json", "text/plain", "application/xhtml+xml"))
                    body = b""
                    outcome = "success"
                    if not allowed:
                        outcome = "blocked_content_type"
                    elif response.status_code != 200:
                        outcome = "not_found" if response.status_code == 404 else "http_error"
                    if allowed:
                        parts, total = [], 0
                        for chunk in response.iter_content(65536):
                            total += len(chunk)
                            if total > 64 * 1024 * 1024:
                                raise FetchError("Text response exceeded 64 MiB; possible truncation needs investigation")
                            parts.append(chunk)
                        body = b"".join(parts)
                    stamp = utcnow()
                    response_id = digest([request_id, stamp, digest(body)])
                    path = None
                    if allowed:
                        path = f"raw/{response_id}.{'json' if 'json' in content_type else 'html'}"
                        target = self.store.root / path
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(body)
                    headers = {k: v for k, v in response.headers.items() if k.lower() in ("content-type", "etag", "last-modified", "content-length", "retry-after")}
                    with self.store.db:
                        self.store.upsert("responses", {"response_id": response_id, "request_id": request_id, "fetched_at": stamp, "final_url": response.url, "status": response.status_code, "content_type": content_type, "headers_json": json_text(headers), "body_path": path, "sha256": digest(body) if allowed else None, "outcome": outcome}, key="response_id")
                    if outcome == "success":
                        with self.store.db:
                            self.store.db.execute("UPDATE requests SET state='fetched',outcome='success',error=NULL WHERE request_id=?", (request_id,))
                        return self.store.rows("SELECT * FROM responses WHERE response_id=?", (response_id,))[0]
                    if response.status_code in (429, 500, 502, 503, 504):
                        retry_after = response.headers.get("Retry-After")
                        wait = self._retry_delay(retry_after, attempt)
                        if wait > 60:
                            # Do not ignore a long server-requested delay or block an interactive session.
                            raise FetchError(f"Server requests a {wait:.0f}s pause; resume later")
                        time.sleep(wait)
                        last_error = f"HTTP {response.status_code}"
                        continue
                    raise FetchError(f"{outcome}: HTTP {response.status_code}, {content_type}")
            except BudgetReached:
                raise
            except requests.RequestException as exc:
                last_error = str(exc)
                if attempt + 1 < self.retries:
                    time.sleep(min(30, 2 ** attempt + random.random()))
        raise FetchError(last_error or "Retry limit reached")

    @staticmethod
    def _retry_delay(value, attempt):
        if value:
            try:
                return max(0, float(value))
            except ValueError:
                try:
                    dt = email.utils.parsedate_to_datetime(value)
                    return max(0, (dt - datetime.now(timezone.utc)).total_seconds())
                except (ValueError, TypeError):
                    pass
        return 2 ** attempt + random.random()
