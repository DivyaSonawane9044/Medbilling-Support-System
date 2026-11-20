import React from "react";
import LoadingSkeleton from "./LoadingSkeleton";
import EmptyState from "./EmptyState";
import "./ui-kit.css";

/** Card frame for a chart: title, subtitle, actions, loading / empty states and a stable body height. */
export default function ChartCard({ title, subtitle, actions, loading, empty, emptyText = "No data for this period yet.", height = 260, children, className = "", testId }) {
  return (
    <section className={`card mb-chartcard ${className}`} data-testid={testId}>
      <div className="mb-chartcard__head">
        <div>
          <h3 className="mb-chartcard__title">{title}</h3>
          {subtitle ? <p className="mb-chartcard__sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="mb-chartcard__actions">{actions}</div> : null}
      </div>
      <div className="mb-chartcard__body" style={{ minHeight: height }}>
        {loading ? <LoadingSkeleton variant="chart" /> : empty ? <EmptyState compact title="No data yet" message={emptyText} /> : children}
      </div>
    </section>
  );
}
