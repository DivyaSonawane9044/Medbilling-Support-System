import React from "react";
import "./ui-kit.css";

/**
 * Decorative doctor / clinic illustration: patient clipboard with a medical cross and ECG trace,
 * a stethoscope, a capsule and a heart. Pure SVG coloured by theme tokens (see .mb-medart in ui-kit.css).
 */
export default function MedicalIllustration({ className = "", title }) {
  return (
    <svg
      className={`mb-medart ${className}`}
      viewBox="0 0 340 250"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
    >
      {/* soft backdrop */}
      <circle className="mi-bg" cx="180" cy="128" r="112" />
      <circle className="mi-ring" cx="180" cy="128" r="96" />

      {/* clipboard */}
      <g className="mi-float mi-float--slow">
        <rect className="mi-board-shadow" x="122" y="52" width="136" height="172" rx="16" />
        <rect className="mi-board" x="116" y="44" width="136" height="172" rx="16" />
        <rect className="mi-clip" x="152" y="32" width="64" height="24" rx="9" />
        <circle className="mi-clip-hole" cx="184" cy="40" r="4" />
        <circle className="mi-badge" cx="148" cy="88" r="17" />
        <path className="mi-cross" d="M144 78h8v6h6v8h-6v6h-8v-6h-6v-8h6z" />
        <rect className="mi-line mi-line--strong" x="174" y="80" width="62" height="7" rx="3.5" />
        <rect className="mi-line" x="174" y="92" width="42" height="6" rx="3" />
        <polyline className="mi-ecg" points="130,140 152,140 159,128 166,152 174,118 182,160 190,140 236,140" />
        <rect className="mi-line" x="130" y="170" width="106" height="6" rx="3" />
        <rect className="mi-line" x="130" y="184" width="80" height="6" rx="3" />
        <rect className="mi-line" x="130" y="198" width="92" height="6" rx="3" />
      </g>

      {/* stethoscope */}
      <g className="mi-float">
        <path className="mi-tube" d="M58 34 C 52 70, 70 92, 86 96 C 104 100, 112 80, 106 40" />
        <path className="mi-tube" d="M82 96 C 82 140, 62 160, 74 190" />
        <circle className="mi-ear" cx="58" cy="32" r="6" />
        <circle className="mi-ear" cx="106" cy="38" r="6" />
        <circle className="mi-chest" cx="80" cy="204" r="19" />
        <circle className="mi-chest-in" cx="80" cy="204" r="10" />
      </g>

      {/* capsule */}
      <g className="mi-float mi-float--alt">
        <g transform="rotate(-28 290 196)">
          <rect className="mi-cap-a" x="258" y="184" width="32" height="26" rx="13" />
          <rect className="mi-cap-b" x="284" y="184" width="32" height="26" rx="13" />
          <rect className="mi-cap-shine" x="266" y="189" width="40" height="5" rx="2.5" />
        </g>
      </g>

      {/* heart */}
      <path
        className="mi-heart mi-float mi-float--alt"
        d="M286 66c-6-12-24-10-24 4 0 12 24 26 24 26s24-14 24-26c0-14-18-16-24-4z"
      />

      {/* sparkles */}
      <path className="mi-spark" d="M42 128h10M47 123v10" />
      <path className="mi-spark" d="M300 132h8M304 128v8" />
      <path className="mi-spark" d="M248 26h8M252 22v8" />
    </svg>
  );
}
