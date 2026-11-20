// Small client-side aggregation helpers for the Dashboard / Analytics / Accounting / Reports pages.
// They only regroup real API rows; they never invent values.

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const money = (v) =>
  `₹${num(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const units = (v) => num(v).toLocaleString("en-IN");

export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local-date key (YYYY-MM-DD) — invoices carry local timestamps. */
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** The last `count` months including the current one, oldest first: [{key, label}] */
export function lastMonths(count = 6, now = new Date()) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) });
  }
  return out;
}

/** Sums `valueOf(row)` per month of `dateOf(row)` into the given month buckets. */
export function sumByMonth(rows, months, dateOf, valueOf) {
  const totals = Object.fromEntries(months.map((m) => [m.key, 0]));
  for (const r of rows) {
    const d = parseDate(dateOf(r));
    if (!d) continue;
    const k = monthKey(d);
    if (k in totals) totals[k] += num(valueOf(r));
  }
  return totals;
}

export function daysUntil(dateValue, now = new Date()) {
  const d = parseDate(dateValue);
  if (!d) return null;
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / 86400000);
}

export function formatDateTime(value) {
  const d = parseDate(value);
  if (!d) return "-";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(value) {
  const d = parseDate(value);
  if (!d) return "-";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** "CASH" / "cash" / "Cash" -> "Cash"; "UPI" stays "UPI". */
export function prettyMethod(m) {
  const s = String(m || "Other").trim();
  if (!s) return "Other";
  if (s.length <= 4) return s.toUpperCase();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
