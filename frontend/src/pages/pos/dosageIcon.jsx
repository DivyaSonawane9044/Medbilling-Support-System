import React from "react";
import "./pos.css";
import { Pill, Tablets, FlaskConical, Droplet, Syringe, Package, Sparkles } from "lucide-react";

// Dosage form -> [icon, tone]. Tone maps to a soft surface in pos.css (.dose-chip--<tone>).
const FORMS = [
  [/tablet/, Tablets, "teal"],
  [/capsule/, Pill, "purple"],
  [/syrup|suspension|liquid/, FlaskConical, "info"],
  [/drop/, Droplet, "info"],
  [/injection|vial/, Syringe, "coral"],
  [/cream|ointment|gel/, Sparkles, "warning"],
];

export function dosageMeta(form) {
  const f = String(form || "").toLowerCase();
  for (const [re, Icon, tone] of FORMS) if (re.test(f)) return { Icon, tone };
  return { Icon: Package, tone: "navy" };
}

/** Small rounded icon tile showing the medicine's dosage form. */
export function DosageChip({ form, size = 36 }) {
  const { Icon, tone } = dosageMeta(form);
  return (
    <span
      className={`dose-chip dose-chip--${tone}`}
      style={{ width: size, height: size }}
      title={form || "Medicine"}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  );
}
