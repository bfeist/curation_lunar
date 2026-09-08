import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import urljoin, urlsplit, urlunsplit, quote

ORIGIN = "https://curator.jsc.nasa.gov"
HOME = ORIGIN + "/lunar/index.cfm"
CATALOG = ORIGIN + "/lunar/samplecatalog/index.cfm"
API = ORIGIN + "/rest/lunarapi/samples/"
PILOT_SAMPLES = ["63586", "64476", "67915", "21000", "10006", "10070"]
ASSET_SUFFIXES = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".tif", ".tiff", ".svg", ".webp", ".bmp", ".ico", ".mp4", ".mov", ".mp3", ".wav", ".zip", ".xls", ".xlsx", ".doc", ".docx", ".ppt", ".pptx", ".css", ".js"}


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def json_text(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value):
    if not isinstance(value, bytes):
        value = json_text(value).encode("utf-8")
    return hashlib.sha256(value).hexdigest()


def identifier(value):
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("Boolean is not an identifier")
    if isinstance(value, (int, float, Decimal)):
        d = Decimal(str(value))
        if not d.is_finite() or d != d.to_integral_value():
            raise ValueError(f"Non-integral identifier: {value!r}")
        return str(int(d))
    return str(value).strip() or None


def number(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        d = Decimal(str(value).strip())
        if not d.is_finite():
            raise ValueError(f"Non-finite number: {value!r}")
        return float(d)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid number: {value!r}") from exc


def boolean(value):
    if value is None:
        return None
    if value in (True, 1, "1", "true", "True"):
        return 1
    if value in (False, 0, "0", "false", "False"):
        return 0
    raise ValueError(f"Unknown boolean: {value!r}")


def date_iso(value):
    if not value:
        return None
    for fmt in ("%B, %d %Y %H:%M:%S", "%b %d, %Y", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(str(value), fmt).date().isoformat()
        except ValueError:
            pass
    return None


def absolute_url(base, href):
    return urljoin(base, (href or "").strip())


def request_url(url):
    p = urlsplit(url)
    # Preserve original links separately; use the site's known HTTPS host for requests.
    scheme = "https" if p.hostname == "curator.jsc.nasa.gov" else p.scheme
    return urlunsplit((scheme, p.netloc.lower(), quote(p.path, safe="/%:@,+;=-_~"), quote(p.query, safe="%=&,+/:;?@-_~"), ""))


def asset_kind(url):
    from pathlib import PurePosixPath
    suffix = PurePosixPath(urlsplit(url).path.lower()).suffix
    if suffix in ASSET_SUFFIXES:
        if suffix in {".jpg", ".jpeg", ".png", ".gif", ".tif", ".tiff", ".svg", ".webp", ".bmp"}:
            return "image"
        if suffix in {".css", ".js", ".ico"}:
            return "site_resource"
        return "document" if suffix in {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"} else "media"
    return None
