import { useEffect, useState } from 'react';

const STORAGE_KEY = 'studysync-theme';
const THEMES = ['light', 'system', 'dark'];

const readStored = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(value) ? value : 'system';
  } catch {
    return 'system'; // storage blocked (private window, disabled site data)
  }
};

/**
 * The visitor's light / dark choice for the themed app screens.
 *
 * 'system' follows the OS preference through CSS alone, so it is expressed as
 * no data-theme attribute at all; 'light' and 'dark' pin it.
 *
 * @returns {[string, Function, string|undefined]} theme, setter, and the value
 *   to put on the themed root's data-theme attribute
 */
export function useTheme() {
  const [theme, setTheme] = useState(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // not persisted; the choice still holds for this visit
    }
  }, [theme]);

  return [theme, setTheme, theme === 'system' ? undefined : theme];
}
