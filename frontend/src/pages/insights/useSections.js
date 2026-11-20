import { useCallback, useEffect, useRef, useState } from "react";
import { handleApiError } from "../../services/api";

// Hard cap per request. The axios timeout (20s) only starts once the request interceptor has
// awaited the Clerk token, so a stalled getToken() could otherwise keep a section "loading" forever.
export const SECTION_TIMEOUT_MS = 25000;

export function withTimeout(promise, ms = SECTION_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`The server did not answer within ${Math.round(ms / 1000)} seconds.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const initial = (keys) => Object.fromEntries(keys.map((k) => [k, { status: "loading", data: null, error: null }]));

/**
 * Loads several independent API sections. Each section settles on its own (ok | error), so one slow or
 * failing endpoint never holds the others in a loading state. A generation counter per key drops stale
 * answers (React StrictMode double-mount, rapid Retry clicks).
 * loaders: { key: () => axiosPromise }. Returns [sections, reload(keys?)].
 * Section status: loading (no data yet) | refreshing (has data) | ok | error.
 */
export default function useSections(loaders) {
  const loadersRef = useRef(loaders);
  loadersRef.current = loaders;
  const gen = useRef({});
  const [sections, setSections] = useState(() => initial(Object.keys(loaders)));

  const reload = useCallback((keys) => {
    const all = loadersRef.current;
    const list = keys && keys.length ? keys : Object.keys(all);
    list.forEach((key) => {
      const g = (gen.current[key] = (gen.current[key] || 0) + 1);
      setSections((s) => ({
        ...s,
        [key]: { ...s[key], status: s[key]?.data != null ? "refreshing" : "loading", error: null },
      }));
      withTimeout(Promise.resolve().then(() => all[key]())).then(
        (res) => {
          if (gen.current[key] !== g) return;
          setSections((s) => ({ ...s, [key]: { status: "ok", data: res?.data ?? null, error: null } }));
        },
        (err) => {
          if (gen.current[key] !== g) return;
          setSections((s) => ({ ...s, [key]: { ...s[key], status: "error", error: handleApiError(err).message } }));
        }
      );
    });
  }, []);

  useEffect(() => {
    reload();
    const current = gen.current;
    return () => {
      // invalidate in-flight answers of this mount
      Object.keys(current).forEach((k) => {
        current[k] += 1;
      });
    };
  }, [reload]);

  return [sections, reload];
}

export const isPending = (sec) => !sec || sec.status === "loading";
export const asArray = (sec) => (Array.isArray(sec?.data) ? sec.data : Array.isArray(sec?.data?.content) ? sec.data.content : []);
