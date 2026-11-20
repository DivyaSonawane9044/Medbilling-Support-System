import React from "react";
import "./ui-kit.css";

/** Shimmering placeholders. variant: "lines" | "stats" | "chart" | "table" */
export default function LoadingSkeleton({ variant = "lines", rows = 4, label = "Loading" }) {
  return (
    <div className={`mb-skeleton mb-skeleton--${variant}`} role="status" aria-label={label}>
      {variant === "stats" &&
        Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="mb-skel-card">
            <span className="mb-skel mb-skel--line" style={{ width: "40%" }} />
            <span className="mb-skel mb-skel--value" />
            <span className="mb-skel mb-skel--line" style={{ width: "60%" }} />
          </div>
        ))}
      {variant === "chart" && <span className="mb-skel mb-skel--chart" />}
      {(variant === "lines" || variant === "table") &&
        Array.from({ length: rows }).map((_, i) => (
          <span
            key={i}
            className={`mb-skel ${variant === "table" ? "mb-skel--row" : "mb-skel--line"}`}
            style={{ width: variant === "lines" ? `${90 - i * 12}%` : undefined }}
          />
        ))}
    </div>
  );
}
