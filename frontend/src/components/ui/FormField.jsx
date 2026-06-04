import React from "react";
import "./FormField.css";

export default function FormField({ label, hint, error, required, children }) {
  return (
    <div className="ff">
      {label ? (
        <div className="ff-label-row">
          <label className="ff-label">
            {label} {required ? <span className="ff-required">*</span> : null}
          </label>
          {hint ? <span className="ff-hint">{hint}</span> : null}
        </div>
      ) : null}

      <div className="ff-control">{children}</div>
      {error ? <div className="ff-error">{error}</div> : null}
    </div>
  );
}

