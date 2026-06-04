import React from "react";
import "./TextInput.css";

export default function TextInput({ value, onChange, placeholder, type = "text", ...rest }) {
  return (
    <input
      className="ti"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      {...rest}
    />
  );
}

