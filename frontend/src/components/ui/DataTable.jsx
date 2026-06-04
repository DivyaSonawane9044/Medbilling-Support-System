import React, { useMemo, useState } from "react";
import "./DataTable.css";

function defaultStringify(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}

export default function DataTable({
  title,
  subtitle,
  columns,
  rows,
  initialPageSize = 10,
  rowKey,
  searchable = true,
  pageSizeOptions = [5, 10, 20, 50],
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  const normalizedColumns = useMemo(
    () =>
      columns.map((c) => ({
        sortable: true,
        searchable: true,
        ...c,
      })),
    [columns]
  );

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    const searchableCols = normalizedColumns.filter((c) => c.searchable);
    return rows.filter((r) =>
      searchableCols.some((c) => {
        const raw = c.accessor ? c.accessor(r) : r[c.key];
        return defaultStringify(raw).toLowerCase().includes(q);
      })
    );
  }, [rows, query, searchable, normalizedColumns]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = normalizedColumns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const dirMul = sort.dir === "asc" ? 1 : -1;
    const getValue = (r) => (col.accessor ? col.accessor(r) : r[col.key]);
    return [...filtered].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dirMul;
      return defaultStringify(av).localeCompare(defaultStringify(bv)) * dirMul;
    });
  }, [filtered, sort, normalizedColumns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  function toggleSort(key) {
    setPage(1);
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  return (
    <div className="dt card">
      <div className="dt-head">
        <div>
          {title ? <h3 className="dt-title">{title}</h3> : null}
          {subtitle ? <p className="dt-subtitle">{subtitle}</p> : null}
        </div>
        <div className="dt-actions">
          {searchable ? (
            <input
              className="dt-search"
              type="search"
              placeholder="Search..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="dt-table-wrap">
        <table className="dt-table">
          <thead>
            <tr>
              {normalizedColumns.map((c) => (
                <th
                  key={c.key}
                  className={`${c.align === "right" ? "num" : ""} ${c.sortable ? "sortable" : ""}`}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                >
                  <span className="th-label">{c.header}</span>
                  {sort.key === c.key ? <span className="th-sort">{sort.dir === "asc" ? "▲" : "▼"}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td className="dt-empty" colSpan={normalizedColumns.length}>
                  No results found.
                </td>
              </tr>
            ) : (
              paged.map((r, idx) => (
                <tr key={rowKey ? rowKey(r) : idx}>
                  {normalizedColumns.map((c) => {
                    const raw = c.accessor ? c.accessor(r) : r[c.key];
                    return (
                      <td key={c.key} className={c.align === "right" ? "num" : ""}>
                        {c.cell ? c.cell(raw, r) : defaultStringify(raw)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="dt-foot">
        <div className="dt-count">
          Showing <b>{paged.length}</b> of <b>{sorted.length}</b>
        </div>
        <div className="dt-pager">
          <label className="dt-page-size">
            Rows:
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {pageSizeOptions.map((o) => (
                <option value={o} key={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={() => setPage(1)} disabled={currentPage === 1}>
            First
          </button>
          <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
            Prev
          </button>
          <span className="dt-page">
            Page <b>{currentPage}</b> / <b>{totalPages}</b>
          </span>
          <button
            className="btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
          <button className="btn" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>
            Last
          </button>
        </div>
      </div>
    </div>
  );
}

