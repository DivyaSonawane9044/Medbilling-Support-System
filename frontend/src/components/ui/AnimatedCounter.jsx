import React, { useEffect, useRef, useState } from "react";

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts up to `value` when it changes (ease-out, ~700ms). `format` turns the number into text. */
export default function AnimatedCounter({ value, format = (n) => Math.round(n).toLocaleString("en-IN"), duration = 700 }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(() => (reduceMotion() ? target : 0));
  const from = useRef(shown);

  useEffect(() => {
    if (reduceMotion()) {
      setShown(target);
      from.current = target;
      return undefined;
    }
    const start = performance.now();
    const begin = from.current;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(begin + (target - begin) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  // Screen readers (and tests) get the final value only
  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="mb-sr-only">{format(target)}</span>
    </>
  );
}
