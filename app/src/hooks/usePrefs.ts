import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'ct.theme';
const TYPE_KEY = 'ct.type';

function store(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode: preference just won't persist */ }
}

/**
 * Theme (dark by default) and large type (16px -> 20px root), both stored on
 * <html> as data attributes and persisted. index.html applies the saved values
 * before first paint, so there is no flash of the wrong theme.
 */
export function usePrefs() {
  const root = document.documentElement;
  const [theme, setTheme] = useState<Theme>(() => (root.dataset.theme === 'light' ? 'light' : 'dark'));
  const [largeType, setLargeType] = useState<boolean>(() => root.dataset.type === 'large');

  useEffect(() => {
    root.dataset.theme = theme;
    store(THEME_KEY, theme);
  }, [root, theme]);

  useEffect(() => {
    if (largeType) root.dataset.type = 'large';
    else delete root.dataset.type;
    store(TYPE_KEY, largeType ? 'large' : 'base');
  }, [root, largeType]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const toggleLargeType = useCallback(() => setLargeType((v) => !v), []);

  return { theme, largeType, toggleTheme, toggleLargeType };
}
