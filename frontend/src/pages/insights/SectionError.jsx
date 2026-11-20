import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import "./insights.css";

/** Inline error for one section with a Retry button. */
export default function SectionError({ title = "Could not load this section", message, onRetry }) {
  return (
    <div className="ins-error" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <div className="ins-error__text">
        <strong>{title}</strong>
        {message ? <span>{message}</span> : null}
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" /> Retry
        </button>
      ) : null}
    </div>
  );
}
