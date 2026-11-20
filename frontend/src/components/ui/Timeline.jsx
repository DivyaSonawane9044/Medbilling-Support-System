import React from "react";
import "./ui-kit.css";

/** Vertical timeline. items: [{ key, title, meta, tone, icon, right }] */
export default function Timeline({ items = [] }) {
  return (
    <ol className="mb-timeline">
      {items.map(({ key, title, meta, tone = "teal", icon: Icon, right }) => (
        <li key={key} className={`mb-timeline__item mb-timeline__item--${tone}`}>
          <span className="mb-timeline__dot" aria-hidden="true">
            {Icon ? <Icon size={12} /> : null}
          </span>
          <div className="mb-timeline__body">
            <div className="mb-timeline__title">{title}</div>
            {meta ? <div className="mb-timeline__meta">{meta}</div> : null}
          </div>
          {right ? <div className="mb-timeline__right">{right}</div> : null}
        </li>
      ))}
    </ol>
  );
}
