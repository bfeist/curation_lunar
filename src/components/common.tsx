import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { catalogPath } from "../data/routes";

export function Loading({ error }: { error?: string }) {
  return error ? (
    <div role="alert" className="notice">
      <p>{error}</p>
      <Link to={catalogPath}>Return to the catalog</Link>
    </div>
  ) : (
    <p role="status" className="loading">
      Loading…
    </p>
  );
}
export function CatalogBrand() {
  return (
    <div className="catalog-brand">
      <Link to={catalogPath}>
        Lunar Sample and PhotoCatalog{" "}
        <img
          src="https://curator.jsc.nasa.gov/_images/nasa_logo.gif"
          alt="NASA"
        />
      </Link>
    </div>
  );
}
export function SectionRow({ children }: { children: ReactNode }) {
  return (
    <tr>
      <th className="section" colSpan={2}>
        {children}
      </th>
    </tr>
  );
}
export function DataRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{children ?? ""}</td>
    </tr>
  );
}
export function Pagination({
  total,
  page,
  pageSize,
  onPage,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="pagination" aria-label="Results pages">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`
          : "0 results"}
      </span>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}
