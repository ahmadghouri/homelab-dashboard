import { useEffect, useState } from 'react';
import { DEFAULT_THEME, THEME_STORAGE_KEY, ThemeContext } from '@/hooks/useTheme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function systemTheme() {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);
  const [systemPreference, setSystemPreference] = useState(systemTheme);
  const resolvedTheme = theme === 'system' ? systemPreference : theme;

  // Follow OS changes while "system" is selected.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const handleChange = () => setSystemPreference(systemTheme());
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  // Sync the <html> class with the active theme (Tailwind dark variant uses `.dark`).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = (nextTheme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Storage can be blocked (private mode). The theme still applies for this visit.
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
