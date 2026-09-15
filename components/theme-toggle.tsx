"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => { setTheme(currentTheme()); }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("openstock:theme", next); } catch { /* private mode */ }
  }

  const dark = theme === "dark";
  return (
    <button
      className={`theme-toggle${dark ? " is-dark" : ""}`}
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span className="theme-toggle__knob" aria-hidden="true" />
    </button>
  );
}
