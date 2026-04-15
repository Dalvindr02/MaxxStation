import React, { createContext, useContext, useMemo, useState } from 'react';
import { AppTheme, getTheme, ResolvedThemeMode, ThemeMode } from '../theme';

type ThemeContextValue = {
  themeMode: ThemeMode;
  resolvedThemeMode: ResolvedThemeMode;
  theme: AppTheme;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');

  const resolvedThemeMode: ResolvedThemeMode = 'dark';

  const theme = useMemo(() => getTheme(resolvedThemeMode), [resolvedThemeMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      resolvedThemeMode,
      theme,
      setThemeMode: () => {},
      toggleTheme: () => {},
    }),
    [themeMode, resolvedThemeMode, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return context;
};
