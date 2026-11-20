import React, { useId } from "react";
import TextInput from "./TextInput";
import Select from "./Select";
import "./FormField.css";

/**
 * Label + control wrapper. When the control is a single form control, the label is linked to it
 * (htmlFor/id) so screen readers and getByLabel() work. Existing ids on the child are kept.
 */
export default function FormField({ label, hint, error, required, children }) {
  const autoId = useId();
  // Link native form controls and the kit's TextInput/Select; an id the child already has is kept.
  const isControl =
    React.isValidElement(children) &&
    (["input", "select", "textarea"].includes(children.type) || children.type === TextInput || children.type === Select);
  const only = isControl ? children : null;
  const controlId = only ? only.props.id || `ff-${autoId.replace(/:/g, "")}` : undefined;
  const control = only && !only.props.id ? React.cloneElement(only, { id: controlId }) : children;

  return (
    <div className="ff">
      {label ? (
        <div className="ff-label-row">
          <label className="ff-label" htmlFor={controlId}>
            {label} {required ? <span className="ff-required">*</span> : null}
          </label>
          {hint ? <span className="ff-hint">{hint}</span> : null}
        </div>
      ) : null}

      <div className="ff-control">{control}</div>
      {error ? <div className="ff-error">{error}</div> : null}
    </div>
  );
}
