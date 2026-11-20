import React, { useCallback, useRef } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";
import "./ui-kit.css";

export const inr = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const inr2 = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const canTilt = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Tiny inline trend line. `data` = numbers oldest → newest. Decorative: the card text carries the value. */
export function Sparkline({ data, width = 96, height = 34, className = "mb-stat__spark" }) {
  const pts = (data || []).map((v) => Number(v) || 0);
  if (pts.length < 2 || pts.every((v) => v === 0)) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const pad = 3;
  const xy = pts.map((v, i) => [
    (i / (pts.length - 1)) * (width - pad * 2) + pad,
    height - pad - ((v - min) / span) * (height - pad * 2),
  ]);
  // Smooth curve through the points (Catmull-Rom → cubic Bézier)
  let d = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`;
  for (let i = 0; i < xy.length - 1; i += 1) {
    const p0 = xy[i - 1] || xy[i];
    const p1 = xy[i];
    const p2 = xy[i + 1];
    const p3 = xy[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const last = xy[xy.length - 1];
  const area = `${d} L${last[0].toFixed(1)},${height} L${xy[0][0].toFixed(1)},${height} Z`;
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <path className="area" d={area} />
      <path className="line" d={d} pathLength="400" />
      <circle cx={last[0]} cy={last[1]} r="3" />
    </svg>
  );
}

/**
 * KPI tile. `tone`: gold | teal | navy | mint | ice | lavender | coral | danger | warning.
 * `trend` (optional) = { value: percent, label } — pass it ONLY when computed from real history.
 * `spark` (optional) = array of real values (oldest → newest) drawn as a sparkline.
 */
export default function StatCard({ icon: Icon, label, value, format, tone = "teal", trend, hint, spark, loading = false, onClick, testId, className = "" }) {
  const Tag = onClick ? "button" : "div";
  const ref = useRef(null);

  // 3D tilt + glow follow the pointer via CSS variables (no React re-render per move)
  const onMove = useCallback((e) => {
    const el = ref.current;
    if (!el || !canTilt()) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${((px - 0.5) * 9).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - py) * 9).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
  }, []);
  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }, []);

  const hasTrend = trend && Number.isFinite(trend.value);

  return (
    <Tag
      ref={ref}
      type={onClick ? "button" : undefined}
      className={`mb-stat mb-stat--${tone} ${onClick ? "mb-stat--clickable" : ""} ${className}`}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      data-testid={testId}
    >
      <div className="mb-stat__top">
        <span className="mb-stat__label">{label}</span>
        {Icon ? (
          <span className="mb-stat__icon" aria-hidden="true">
            <Icon size={21} strokeWidth={2.1} />
          </span>
        ) : null}
      </div>
      <div className="mb-stat__value">
        {loading ? (
          <span className="mb-skel mb-skel--value" />
        ) : value == null ? (
          "—"
        ) : typeof value === "number" ? (
          <AnimatedCounter value={value} format={format} />
        ) : (
          value
        )}
      </div>
      {hasTrend || (spark && !loading) ? (
        <div className="mb-stat__meta">
          {hasTrend ? (
            <div className={`mb-stat__trend ${trend.value >= 0 ? "is-up" : "is-down"}`}>
              {trend.value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {/* Huge ratios (e.g. yesterday almost zero) are real but unreadable; cap the display */}
              {Math.abs(trend.value) > 999 ? ">999" : Math.abs(trend.value).toFixed(1)}% <span>{trend.label}</span>
            </div>
          ) : (
            <span />
          )}
          {spark && !loading ? <Sparkline data={spark} /> : null}
        </div>
      ) : null}
      {hint ? <div className="mb-stat__hint">{hint}</div> : null}
    </Tag>
  );
}
