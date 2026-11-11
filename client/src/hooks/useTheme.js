import { createContext, useContext } from 'react';

export const THEME_STORAGE_KEY = 'homelab-theme';
export const DEFAULT_THEME = 'dark';

export const ThemeContext = createContext(null);

// Returns { theme, resolvedTheme, setTheme }. theme can be 'light', 'dark', or 'system'.
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
