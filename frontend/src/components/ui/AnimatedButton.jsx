import React from "react";

/**
 * Button with variants (default | primary | navy | ghost | danger), optional icon and a loading state.
 * Uses the global .btn styles (hover lift, press feedback, focus ring).
 */
const AnimatedButton = React.forwardRef(function AnimatedButton(
  { variant = "default", size, icon: Icon, loading = false, children, className = "", type = "button", disabled, ...rest },
  ref
) {
  const cls = ["btn", variant !== "default" ? `btn-${variant}` : "", size === "sm" ? "btn-sm" : "", loading ? "is-loading" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

export default AnimatedButton;
