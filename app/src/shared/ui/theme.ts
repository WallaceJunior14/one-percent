import { useColorScheme } from 'react-native';

/** Cores verificadas contra WCAG AA em `theme.test.tsx`. */
export const palettes = {
  light: {
    background: '#FFFFFF',
    surface: '#F4F5F7',
    text: '#14161A',
    textMuted: '#5A606B',
    primary: '#2F5BEA',
    onPrimary: '#FFFFFF',
    border: '#D9DCE2',
    paper: '#7A3FE4',
    warning: '#B45309',
  },
  dark: {
    background: '#0F1115',
    surface: '#1A1D23',
    text: '#F2F3F5',
    textMuted: '#A3A9B4',
    primary: '#7C9CFF',
    onPrimary: '#0F1115',
    border: '#2C3039',
    paper: '#B08CFF',
    warning: '#F59E0B',
  },
};

/** Razão de contraste WCAG 2.1 entre duas cores `#RRGGBB` (de 1 a 21). */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export type Theme = { colors: (typeof palettes)['light']; spacing: (n: number) => number };

/** Tema claro/escuro conforme o sistema. */
export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { colors: palettes[scheme], spacing: (n) => n * 8 };
}
