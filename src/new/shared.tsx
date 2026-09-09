import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Results } from "../types/content";

export const Arrow = () => (
  <span aria-hidden="true" className="n-arrow">
    ↗
  </span>
);
export const formatNumber = (n: number | null | undefined) =>
  n == null
    ? "Not recorded"
    : n.toLocaleString("en-US", { maximumFractionDigits: 4 });
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`n-notice${error ? " n-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function RemoteImage({
  src,
  alt,
  eager = false,
}: {
  src?: string | null;
  alt: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return src && failed !== src ? (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(src)}
    />
  ) : (
    <div className="n-image-fallback">
      <span aria-hidden="true">◌</span>
      <span>Image unavailable</span>
    </div>
  );
}
export function SearchBox({
  initial = "",
  target = "/new/catalog",
  label = "Search the sample catalog",
  placeholder = "Sample number or description",
  onSearch,
}: {
  initial?: string;
  target?: string;
  label?: string;
  placeholder?: string;
  onSearch?: (q: string) => void;
}) {
  const navigate = useNavigate();
  return (
    <form
      role="search"
      className="n-search"
      onSubmit={(event) => {
        event.preventDefault();
        const q = String(
          new FormData(event.currentTarget).get("q") ?? "",
        ).trim();
        if (onSearch) onSearch(q);
        else navigate(`${target}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      }}
    >
      <label className="n-sr" htmlFor="n-search-input">
        {label}
      </label>
      <span aria-hidden="true" className="n-search-icon">
        ⌕
      </span>
      <input
        key={initial}
        id="n-search-input"
        name="q"
        defaultValue={initial}
        placeholder={placeholder}
        type="search"
      />
      <button type="submit">
        Search <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}

/** Mounted with a query key so filters cancel and discard the previous stream. */
export function ResultStream<T extends { id: string }>({
  endpoint,
  query,
  render,
  noun,
  className = "n-card-grid",
}: {
  endpoint: string;
  query: string;
  render: (item: T) => ReactNode;
  noun: string;
  className?: string;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number>();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [automatic, setAutomatic] = useState(true);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(query);
    params.set("page", String(page));
    params.set("pageSize", "24");
    void fetch(`${endpoint}?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Results could not be loaded. Please try again.");
        return response.json() as Promise<Results<T>>;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setItems((previous) => [
          ...new Map(
            [...previous, ...result.items].map((item) => [item.id, item]),
          ).values(),
        ]);
        setTotal(result.total);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error ? cause.message : "Unable to load results.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [endpoint, query, page, retry]);
  const hasMore = total !== undefined && items.length < total;
  // Pause every three pages to keep the footer reachable and network use bounded.
  const canAuto = automatic && page % 3 !== 0;
  useEffect(() => {
    if (
      !sentinel.current ||
      !canAuto ||
      loading ||
      error ||
      !hasMore ||
      !("IntersectionObserver" in window)
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          setLoading(true);
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [canAuto, loading, error, hasMore]);
  return (
    <>
      <div className="n-results-meta">
        <p role="status" aria-live="polite">
          {total === undefined ? (
            "Finding results…"
          ) : (
            <>
              <strong>{formatNumber(total)}</strong> {noun} · {items.length}{" "}
              shown
            </>
          )}
        </p>
        <label className="n-check">
          <input
            type="checkbox"
            checked={automatic}
            onChange={(event) => setAutomatic(event.target.checked)}
          />{" "}
          Load as I scroll
        </label>
      </div>
      <div className={className} aria-busy={loading}>
        {items.map((item) => (
          <div key={item.id}>{render(item)}</div>
        ))}
      </div>
      {!loading && !error && total === 0 && (
        <Notice>No matches. Try a broader search or remove a filter.</Notice>
      )}
      <div className="n-stream-end" ref={sentinel}>
        {error ? (
          <Notice error>
            {error}{" "}
            <button
              className="n-button n-outline"
              onClick={() => {
                setError("");
                setLoading(true);
                setRetry((r) => r + 1);
              }}
            >
              Retry
            </button>
          </Notice>
        ) : loading ? (
          <p role="status">Loading {noun}…</p>
        ) : hasMore ? (
          <button
            className="n-button n-outline"
            onClick={() => {
              setLoading(true);
              setPage((p) => p + 1);
            }}
          >
            Load more {noun} <span aria-hidden="true">↓</span>
          </button>
        ) : items.length > 0 ? (
          <p>
            All {formatNumber(total)} {noun} shown.
          </p>
        ) : null}
      </div>
    </>
  );
}
export function Breadcrumb({
  current,
  catalog = false,
}: {
  current: string;
  catalog?: boolean;
}) {
  return (
    <nav className="n-breadcrumb" aria-label="Breadcrumb">
      <Link to="/new">Lunar Curation</Link>
      <span aria-hidden="true">/</span>
      {catalog && (
        <>
          <Link to="/new/catalog">Sample catalog</Link>
          <span aria-hidden="true">/</span>
        </>
      )}
      <span aria-current="page">{current}</span>
    </nav>
  );
}
