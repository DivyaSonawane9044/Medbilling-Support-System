import React from "react";
import "./Badge.css";

export default function Badge({ tone = "gray", children }) {
  return <span className={`bd bd-${tone}`}>{children}</span>;
}

