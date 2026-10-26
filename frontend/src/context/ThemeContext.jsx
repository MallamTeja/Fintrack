import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const KEY = 'theme';

function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function stored() {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }) {
  const [choice, setChoice] = useState(() => stored());
  const [system, setSystem] = useState(() => systemTheme());

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (choice) root.dataset.theme = choice;
    else delete root.dataset.theme;
  }, [choice]);

  const setTheme = useCallback((t) => {
    const next = t === 'light' || t === 'dark' ? t : null;
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      /* preference lasts for this visit only */
    }
    setChoice(next);
  }, []);

  /** Apply a server preference only when this browser has no explicit choice yet. */
  const adoptServerTheme = useCallback((t) => {
    if (!stored() && (t === 'light' || t === 'dark')) setChoice(t);
  }, []);

  const theme = choice || system;
  return (
    <ThemeContext.Provider value={{ theme, choice, setTheme, adoptServerTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
