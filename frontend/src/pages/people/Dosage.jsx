import React from "react";
import { Moon, Sun, Sunrise, Sunset } from "lucide-react";
import "./people.css";

/** The four dosage slots, in the order pharmacists write them (1-0-0-1 = morning + night). */
export const DOSE_SLOTS = [
  { key: "morning", label: "Morning", icon: Sunrise },
  { key: "afternoon", label: "Afternoon", icon: Sun },
  { key: "evening", label: "Evening", icon: Sunset },
  { key: "night", label: "Night", icon: Moon },
];

/** "1-0-0-1" style code built from the saved booleans. */
export const doseCode = (row) => DOSE_SLOTS.map((s) => (row?.[s.key] ? "1" : "0")).join("-");

/**
 * Icon toggles for the four slots. Each is a real checkbox (stretched invisibly over its chip),
 * so the label text ("Morning"...) stays the accessible name and keyboard/space toggling works.
 */
export function DoseToggles({ value, onToggle, named = false }) {
  return (
    <div className="pp-dose-toggles" role="group" aria-label="Dosage timings">
      {DOSE_SLOTS.map(({ key, label, icon: Icon }) => {
        const on = !!value[key];
        return (
          <label key={key} className={`pp-dose-toggle pp-dose-toggle--${key} ${on ? "is-on" : ""}`}>
            <input type="checkbox" name={named ? key : undefined} checked={on} onChange={(e) => onToggle(key, e.target.checked)} />
            <span className="pp-dose-toggle__icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <span className="pp-dose-toggle__label">{label}</span>
          </label>
        );
      })}
    </div>
  );
}

/** Read-only chips for the slots that are switched on. `chipClass` keeps page-specific hooks. */
export function DoseChips({ row, chipClass = "" }) {
  const active = DOSE_SLOTS.filter((s) => row?.[s.key]);
  if (!active.length) return <span className="pp-dose-none">No timings set</span>;
  return active.map(({ key, label, icon: Icon }) => (
    <span key={key} className={`pp-dose-chip pp-dose-chip--${key} ${chipClass}`}>
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  ));
}

/** Segmented radio group (e.g. Any time / Before food / After food). */
export function Segmented({ name, options, value, onChange, label }) {
  return (
    <div className="pp-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.value} className={`pp-seg__opt ${value === o.value ? "is-on" : ""}`}>
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** Inline success / error line. */
export function Msg({ msg, className = "" }) {
  if (!msg) return null;
  return <div className={`pp-msg pp-msg--${msg.type} ${className}`}>{msg.text}</div>;
}
