import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

// Two looks: "light" = White Medical (default, for doctors and pharmacy staff), "dark" = Black + Gold premium.
// The choice is a per-device convenience kept in localStorage; it applies to <html data-theme>.
const KEY = "mb.theme";
const ThemeContext = createContext({ theme: "light", toggleTheme: () => {} });

export function readTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return t === "dark" || t === "light" ? t : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#08090d" : "#ffffff");
}

export const isLightTheme = () => typeof document === "undefined" || document.documentElement.dataset.theme !== "dark";

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable: keep in memory only */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
