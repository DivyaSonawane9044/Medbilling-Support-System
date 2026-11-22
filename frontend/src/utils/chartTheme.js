// Shared Recharts styling so every chart in the app looks the same, in both themes.
// Recharts writes colours as SVG attributes (CSS variables don't work there), so values are resolved
// from the active theme each time a chart renders: spreading `{...axisProps}` reads the getters below.
// Categorical series order is fixed, never cycled, and avoids the amber / red status colours.
const isLight = () => typeof document === "undefined" || document.documentElement.dataset.theme !== "dark";

const DARK_SERIES = ["#d4af37", "#7cb7ff", "#4fd1c5", "#b9a3ff", "#f472b6", "#f4d675"];
// White Medical theme: medical teal first, then clearly different hues, all >= 3:1 against white
const LIGHT_SERIES = ["#0e7f78", "#2f6fd6", "#8b5cf6", "#c2458a", "#0891b2", "#64748b"];

export const CHART_COLORS = new Proxy(DARK_SERIES, {
  get: (target, prop) => Reflect.get(isLight() ? LIGHT_SERIES : target, prop),
});

/** Surface colour used to separate pie / donut slices. */
export const chartSurface = () => (isLight() ? "#ffffff" : "#181a20");

/** Theme colours for hand-built chart gradients (gold area fills, active dots). */
export const chartGold = () =>
  isLight()
    ? { line: ["#0d6e69", "#14b8a6", "#0e7f78"], fill: "#14b8a6", dot: "#0e7f78", dotStroke: "#ffffff" }
    : { line: ["#b8932a", "#f4d675", "#d4af37"], fill: "#d4af37", dot: "#f4d675", dotStroke: "#08090d" };

export const axisProps = {
  get tick() {
    return { fill: isLight() ? "#6b7280" : "#8b8b94", fontSize: 12 };
  },
  tickLine: false,
  get axisLine() {
    return { stroke: isLight() ? "#e5e7eb" : "rgba(255,255,255,0.08)" };
  },
};

export const gridProps = {
  get stroke() {
    return isLight() ? "#eef1f5" : "rgba(255,255,255,0.06)";
  },
  strokeDasharray: "4 4",
  vertical: false,
};

export const tooltipProps = {
  get contentStyle() {
    return isLight()
      ? { borderRadius: 12, border: "1px solid rgba(14, 127, 120,0.35)", background: "#ffffff", boxShadow: "0 16px 36px -16px rgba(16,24,40,.3)", fontSize: 13, padding: "8px 12px", color: "#111827" }
      : { borderRadius: 12, border: "1px solid rgba(20, 184, 166,0.35)", background: "rgba(17,19,24,0.96)", boxShadow: "0 18px 40px -16px rgba(0,0,0,.9), 0 0 24px -12px rgba(20, 184, 166,.5)", fontSize: 13, padding: "8px 12px", color: "#ffffff" };
  },
  get labelStyle() {
    return { color: isLight() ? "#0b5f5a" : "#f4d675", fontWeight: 700, marginBottom: 4 };
  },
  get itemStyle() {
    return { color: isLight() ? "#374151" : "#e4e4e7" };
  },
  get cursor() {
    return { fill: isLight() ? "rgba(176,138,34,0.07)" : "rgba(212,175,55,0.06)" };
  },
};

// Compact rupee labels for axes: 950, 1.2k, 3.4L, 1.1Cr (Indian units)
export function inrShort(n) {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
  return `₹${Math.round(v)}`;
}

export const inrFull = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Animate charts on first render only, and never for reduced-motion users
export const chartAnimation = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? { isAnimationActive: false }
    : { isAnimationActive: true, animationDuration: 700, animationEasing: "ease-out" };
