import React from "react";
import "./SummaryCard.css";

export default function SummaryCard({ title, value, subtitle, children }) {
  return (
    <div className="summary-card">
      <div className="card-main">
        <div className="card-title">{title}</div>
        <div className="card-value">{value}</div>
        <div className="card-sub">{subtitle}</div>
      </div>
      {children && <div className="card-extra">{children}</div>}
    </div>
  );
}
