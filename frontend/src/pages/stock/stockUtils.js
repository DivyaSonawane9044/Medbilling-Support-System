// Shared helpers for the stock pages (Inventory, Expiry Tracking, Purchases).

/** "YYYY-MM-DD" -> local Date (new Date("YYYY-MM-DD") parses as UTC midnight). */
export function parseLocalDate(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Whole days from today to the given date (negative = in the past), or null. */
export function daysUntil(value) {
  const d = parseLocalDate(value);
  if (!d) return null;
  return Math.round((d - startOfToday()) / 86400000);
}

/** Human "days left" text for an expiry date. */
export function daysLeftText(days) {
  if (days === null || days === undefined) return "—";
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "today";
  return `${days}d left`;
}

/** Stock value at cost for a batch DTO: costPrice / unitsPerPack * totalUnits. */
export function batchCostValue(item) {
  const per = Math.max(1, Number(item?.product?.stripSize) || 1);
  return ((Number(item?.costPrice) || 0) / per) * (Number(item?.totalUnits) || 0);
}

export function fmtDate(v) {
  const d = parseLocalDate(v);
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : v ? String(v) : "—";
}
