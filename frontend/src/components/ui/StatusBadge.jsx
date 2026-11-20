import React from "react";
import { AlertTriangle, CheckCircle2, Clock, PackageX, XCircle, Info, CircleDot } from "lucide-react";
import "./ui-kit.css";

// Status keyword -> [tone, icon, label]. Unknown statuses render neutrally with their own text.
const MAP = {
  PAID: ["success", CheckCircle2, "Paid"],
  SUCCESS: ["success", CheckCircle2, "Success"],
  RECEIVED: ["success", CheckCircle2, "Received"],
  IN_STOCK: ["success", CheckCircle2, "In stock"],
  OK: ["success", CheckCircle2, "OK"],
  PARTIAL: ["warning", Clock, "Partial"],
  PENDING: ["warning", Clock, "Pending"],
  CREATED: ["info", Clock, "Awaiting payment"],
  LOW_STOCK: ["warning", AlertTriangle, "Low stock"],
  NEAR_EXPIRY: ["warning", AlertTriangle, "Near expiry"],
  UNPAID: ["danger", XCircle, "Unpaid"],
  FAILED: ["danger", XCircle, "Failed"],
  OUT_OF_STOCK: ["danger", PackageX, "Out of stock"],
  EXPIRED: ["danger", XCircle, "Expired"],
  INFO: ["info", Info, "Info"],
};

export default function StatusBadge({ status, label, tone: toneOverride, icon = true, size = "md" }) {
  const key = String(status || "").toUpperCase().replace(/[\s-]+/g, "_");
  const [tone, Icon, text] = MAP[key] || ["neutral", CircleDot, status || "—"];
  return (
    <span className={`mb-status mb-status--${toneOverride || tone} mb-status--${size}`}>
      {icon ? <Icon size={size === "sm" ? 12 : 14} aria-hidden="true" /> : null}
      {label || text}
    </span>
  );
}
