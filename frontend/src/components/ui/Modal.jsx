import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import "./ui-kit.css";

/** Accessible dialog: fade + scale enter/exit, Esc / backdrop click to close, focus moved into the panel. */
export default function Modal({ open, onClose, title, children, footer, width = 520 }) {
  const reduce = useReducedMotion();
  const panelRef = useRef(null);
  // Latest onClose without re-running the effects below (parents often pass a new function each render)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus the dialog only when it opens, so typing in its inputs never loses focus
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onCloseRef.current?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="mb-modal__backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="mb-modal"
            style={{ maxWidth: width }}
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <div className="mb-modal__head">
              <h2 className="mb-modal__title">{title}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close dialog">
                <X />
              </button>
            </div>
            <div className="mb-modal__body">{children}</div>
            {footer ? <div className="mb-modal__foot">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
