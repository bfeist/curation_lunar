import { useState } from "react";
import { Link } from "react-router-dom";
import type { Photo } from "../types/content";
import { photoPath } from "../data/routes";
import { Pagination } from "./common";

export function PhotoImage({ photo }: { photo: Photo }) {
  const [failed, setFailed] = useState(false);
  return photo.preview && !failed ? (
    <img
      src={photo.preview}
      alt={photo.description || `Lunar photo ${photo.id}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="image-unavailable">
      {photo.id}
      <small>
        {failed ? "Image unavailable from source" : "Preview not yet acquired"}
      </small>
    </span>
  );
}
export function PhotoCards({ photos }: { photos: Photo[] }) {
  return (
    <div className="photo-grid">
      {photos.map((photo) => (
        <figure key={photo.id}>
          <Link to={photoPath(photo.id)}>
            <PhotoImage photo={photo} />
            <figcaption>Photo Number: {photo.id}</figcaption>
          </Link>
        </figure>
      ))}
    </div>
  );
}
export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState("asc");
  const [number, setNumber] = useState("");
  const [description, setDescription] = useState("");
  const ordered = photos
    .filter(
      (photo) =>
        photo.id.toLowerCase().includes(number.toLowerCase()) &&
        (photo.description ?? "")
          .toLowerCase()
          .includes(description.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id),
    );
  return (
    <div className="gallery">
      <div className="gallery-tools">
        <button
          onClick={() => {
            setNumber("");
            setDescription("");
            setPage(1);
            setPageSize(10);
            setSort("asc");
          }}
        >
          Reset
        </button>
        <label>
          Photos per page{" "}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Sort by{" "}
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="asc">Photo number ↑</option>
            <option value="desc">Photo number ↓</option>
          </select>
        </label>
      </div>
      <div className="gallery-filters">
        <input
          aria-label="Filter by Photo Number"
          placeholder="Filter by Photo Number"
          value={number}
          onChange={(event) => {
            setNumber(event.target.value);
            setPage(1);
          }}
        />
        <input
          aria-label="Filter by Description"
          placeholder="Filter by Description"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setPage(1);
          }}
        />
      </div>
      <PhotoCards
        photos={ordered.slice((page - 1) * pageSize, page * pageSize)}
      />
      <Pagination
        total={ordered.length}
        page={page}
        pageSize={pageSize}
        onPage={setPage}
      />
    </div>
  );
}
