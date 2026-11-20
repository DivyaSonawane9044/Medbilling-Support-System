import React from "react";
import "./ui-kit.css";

const ECG =
  "M0 40 H150 L160 40 L168 30 L176 40 H200 L210 40 L218 8 L228 56 L238 22 L246 40 H300 L312 40 L320 32 L330 40 H420 L430 40 L438 10 L448 54 L458 26 L466 40 H520 L530 34 L540 40 H600";

/** Page title bar: icon tile, title, subtitle and right-aligned actions. variant="hero" = highlight banner with an ECG trace. */
export default function PageHeader({ icon: Icon, title, subtitle, eyebrow, actions, variant = "plain", children }) {
  return (
    <header className={`mb-pagehead mb-pagehead--${variant} mb-animate-in`}>
      <div className="mb-pagehead__main">
        {Icon ? (
          <span className="mb-pagehead__icon" aria-hidden="true">
            <Icon size={22} strokeWidth={2} />
          </span>
        ) : null}
        <div className="mb-pagehead__text">
          {eyebrow ? <div className="mb-pagehead__eyebrow">{eyebrow}</div> : null}
          <h1 className="mb-pagehead__title">{title}</h1>
          {subtitle ? <p className="mb-pagehead__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="mb-pagehead__actions">{actions}</div> : null}
      {children}
      {variant === "hero" ? (
        // Decorative ECG heartbeat trace (medical motif)
        <svg className="mb-ecg" viewBox="0 0 600 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path className="mb-ecg__glow" d={ECG} />
          <path d={ECG} pathLength="1000" />
        </svg>
      ) : null}
    </header>
  );
}
