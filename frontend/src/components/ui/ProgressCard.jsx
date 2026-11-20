import React from "react";
import "./ui-kit.css";

/**
 * Horizontal meter for real quantities (value / max). Tone follows thresholds unless given:
 * <=15% danger, <=40% warning, otherwise success.
 */
export function ProgressBar({ value = 0, max = 100, tone, label, showValue = false, size = "md" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100)) : 0;
  const auto = pct <= 15 ? "danger" : pct <= 40 ? "warning" : "success";
  return (
    <div className={`mb-progress mb-progress--${size}`}>
      <div
        className="mb-progress__track"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || "Progress"}
      >
        <div className={`mb-progress__fill mb-progress__fill--${tone || auto}`} style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      {showValue ? <span className="mb-progress__val">{Math.round(pct)}%</span> : null}
    </div>
  );
}

export default function ProgressCard({ icon: Icon, title, value, max, caption, tone }) {
  return (
    <div className="mb-progress-card card">
      <div className="mb-progress-card__head">
        {Icon ? (
          <span className="mb-progress-card__icon" aria-hidden="true">
            <Icon size={18} />
          </span>
        ) : null}
        <span className="mb-progress-card__title">{title}</span>
        <span className="mb-progress-card__num">
          {Number(value).toLocaleString("en-IN")}
          {max != null ? <small> / {Number(max).toLocaleString("en-IN")}</small> : null}
        </span>
      </div>
      <ProgressBar value={value} max={max ?? 100} tone={tone} label={title} />
      {caption ? <div className="mb-progress-card__caption">{caption}</div> : null}
    </div>
  );
}
