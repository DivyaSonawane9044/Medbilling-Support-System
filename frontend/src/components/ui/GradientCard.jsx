import React from "react";
import "./ui-kit.css";

/** Highlight surface: variant "brand" (navy to teal), "soft" (ice to mint), "mint", "lavender", "coral". */
export default function GradientCard({ variant = "soft", className = "", children, as: Tag = "section", ...rest }) {
  return (
    <Tag className={`mb-gcard mb-gcard--${variant} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
