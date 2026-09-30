import React, { createContext, useContext } from 'react';
import { useTheme } from '../../hooks/useTheme';

const ThemeContext = createContext(null);

/** The light / dark choice of the surrounding AppShell, for the theme switch */
export function useThemeChoice() {
  return useContext(ThemeContext);
}

/**
 * Root of every signed-in screen. `.landing` brings the brand tokens (the same
 * ones the landing page uses) and `.app-theme` re-maps the stock Tailwind
 * palette the panels are written in (see app-theme.css). data-theme pins light
 * or dark; without it the system setting decides.
 */
export default function AppShell({ className = '', children }) {
  const [theme, setTheme, dataTheme] = useTheme();
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={`landing app-theme ${className}`} data-theme={dataTheme}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
