import React from "react";
import { Inbox } from "lucide-react";

/**
 * Empty panel that looks like the kit's EmptyState but has no role="status":
 * the stock pages announce action results through a single status banner.
 */
export default function QuietEmpty({ icon: Icon = Inbox, title, message }) {
  return (
    <div className="mb-empty mb-empty--compact">
      <div className="mb-empty__art" aria-hidden="true">
        <span className="mb-empty__ring" />
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="mb-empty__title">{title}</div>
      {message ? <p className="mb-empty__msg">{message}</p> : null}
    </div>
  );
}
