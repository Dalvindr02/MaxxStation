export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedThemeMode = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  backgroundSecondary: string;
  card: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  secondary: string;
  danger: string;
  success: string;
  warning: string;
  border: string;
  chip: string;
  sunsetSoft: string;
  blueSoft: string;
  greenSoft: string;
  orangeSoft: string;
  error: string;
  shadow: string;
  glow: string;
  glowStrong: string;
  overlay: string;
};

export type ThemeGradients = {
  screen: string[];
  card: string[];
  hero: string[];
  accent: string[];
  button: string[];
};

export type AppTheme = {
  colors: ThemeColors;
  gradients: ThemeGradients;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
  };
  isDark: boolean;
};

const lightColors: ThemeColors = {
  background: '#140824',
  backgroundSecondary: '#2B1450',
  card: 'rgba(255,255,255,0.05)',
  surface: 'rgba(255,255,255,0.05)',
  text: '#F8EEFF',
  muted: '#D8B9FF',
  primary: 'rgb(255, 27, 107)',
  secondary: 'rgb(69, 202, 255)',
  danger: '#EF4444',
  success: '#5DFFA9',
  warning: '#FFD86B',
  border: 'rgba(255,255,255,0.1)',
  chip: 'rgba(255,255,255,0.08)',
  sunsetSoft: 'rgba(255, 27, 107, 0.18)',
  blueSoft: 'rgba(69, 202, 255, 0.18)',
  greenSoft: 'rgba(93,255,169,0.18)',
  orangeSoft: 'rgba(255,138,92,0.18)',
  error: '#DC2626',
  shadow: '#02010A',
  glow: 'rgb(255, 27, 107)',
  glowStrong: 'rgb(69, 202, 255)',
  overlay: 'rgba(20,8,36,0.82)',
};

const darkColors: ThemeColors = {
  background: '#140824',
  backgroundSecondary: '#2B1450',
  card: 'rgba(255,255,255,0.05)',
  surface: 'rgba(255,255,255,0.05)',
  text: '#F8EEFF',
  muted: '#C8B2F0',
  primary: 'rgb(255, 27, 107)',
  secondary: 'rgb(69, 202, 255)',
  danger: '#F87171',
  success: '#5DFFA9',
  warning: '#FFD86B',
  border: 'rgba(255,255,255,0.1)',
  chip: 'rgba(255,255,255,0.08)',
  sunsetSoft: 'rgba(255, 27, 107, 0.18)',
  blueSoft: 'rgba(69, 202, 255, 0.18)',
  greenSoft: 'rgba(93,255,169,0.18)',
  orangeSoft: 'rgba(255,138,92,0.18)',
  error: '#F87171',
  shadow: '#000000',
  glow: 'rgb(255, 27, 107)',
  glowStrong: 'rgb(69, 202, 255)',
  overlay: 'rgba(20,8,36,0.84)',
};

const lightGradients: ThemeGradients = {
  screen: ['#140824', '#2B1450', '#6A0DAD'],
  card: ['#3B0A63', '#1A0033'],
  hero: ['#3B0A63', '#2B1450', '#6A0DAD'],
  accent: ['rgba(255, 27, 107, 0.34)', 'rgba(69, 202, 255, 0.24)'],
  button: ['rgb(255, 27, 107)', 'rgb(69, 202, 255)'],
};

const darkGradients: ThemeGradients = {
  screen: ['#140824', '#2B1450', '#6A0DAD'],
  card: ['#3B0A63', '#1A0033'],
  hero: ['#3B0A63', '#2B1450', '#6A0DAD'],
  accent: ['rgba(255, 27, 107, 0.34)', 'rgba(69, 202, 255, 0.24)'],
  button: ['rgb(255, 27, 107)', 'rgb(69, 202, 255)'],
};

const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
};

const radius = {
  sm: 8,
  md: 14,
  lg: 20,
};

export const getTheme = (mode: ResolvedThemeMode): AppTheme => ({
  colors: mode === 'dark' ? darkColors : lightColors,
  gradients: mode === 'dark' ? darkGradients : lightGradients,
  spacing,
  radius,
  isDark: mode === 'dark',
});

export const theme = getTheme('light');
