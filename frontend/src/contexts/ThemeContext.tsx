import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'faint' | 'light';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  isFaint: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const THEME_STORAGE_KEY = 'gurukul_sports_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'faint' || stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      // Ignore storage access errors
    }
    // Default to dark mode
    return 'dark';
  });

  const isDark = theme === 'dark';
  const isFaint = !isDark;

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (isDark) {
      root.classList.add('dark');
      body?.classList.add('dark');
      root.classList.remove('faint', 'light');
      body?.classList.remove('faint', 'light');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      body?.classList.remove('dark');
      root.classList.add('faint', 'light');
      body?.classList.add('faint', 'light');
      root.setAttribute('data-theme', 'faint');
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme, isDark]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'faint' : 'dark'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, isFaint, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
