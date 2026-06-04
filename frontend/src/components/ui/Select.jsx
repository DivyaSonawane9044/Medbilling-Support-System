import React from "react";
import "./Select.css";

export default function Select({ value, onChange, options, placeholder = "Select...", ...rest }) {
  return (
    <select className="sel" value={value} onChange={onChange} {...rest}>
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option value={o.value} key={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

