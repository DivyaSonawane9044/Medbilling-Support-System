import React from "react";
import { Inbox } from "lucide-react";
import "./ui-kit.css";

/** Friendly empty / zero-data panel with an icon illustration and optional action. */
export default function EmptyState({ icon: Icon = Inbox, title = "Nothing here yet", message, action, compact = false }) {
  return (
    <div className={`mb-empty ${compact ? "mb-empty--compact" : ""}`}>
      <div className="mb-empty__art" aria-hidden="true">
        <span className="mb-empty__ring" />
        <Icon size={compact ? 22 : 28} strokeWidth={1.8} />
      </div>
      <div className="mb-empty__title">{title}</div>
      {message ? <p className="mb-empty__msg">{message}</p> : null}
      {action ? <div className="mb-empty__action">{action}</div> : null}
    </div>
  );
}
