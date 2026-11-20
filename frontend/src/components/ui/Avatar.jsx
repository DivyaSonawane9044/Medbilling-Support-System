import React from "react";
import "./ui-kit.css";

const TONES = ["teal", "navy", "purple", "coral", "info"];

/** Initials avatar (no invented photos). Colour is stable per name. */
export default function Avatar({ name = "", size = 36 }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "?";
  const tone = TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length];
  return (
    <span className={`mb-avatar mb-avatar--${tone}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials}
    </span>
  );
}
