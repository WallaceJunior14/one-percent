import { useColorScheme } from 'react-native';

const palettes = {
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

export type Theme = { colors: (typeof palettes)['light']; spacing: (n: number) => number };

/** Tema claro/escuro conforme o sistema (RNF-007). */
export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { colors: palettes[scheme], spacing: (n) => n * 8 };
}
