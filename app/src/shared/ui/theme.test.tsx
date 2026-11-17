import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { contrastRatio, palettes, useTheme } from './theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

const scheme = jest.mocked(useColorScheme);

/** WCAG 2.1 AA para texto normal (RNF-007). */
const AA = 4.5;
const TEXT_COLORS = ['text', 'textMuted', 'primary', 'paper', 'warning'] as const;
const BACKGROUNDS = ['background', 'surface'] as const;

describe.each(['light', 'dark'] as const)('%s palette', (name) => {
  const colors = palettes[name];

  test.each(TEXT_COLORS.flatMap((fg) => BACKGROUNDS.map((bg) => [fg, bg] as const)))(
    '%s_on_%s_meets_AA',
    (fg, bg) => {
      expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(AA);
    },
  );

  test('on_primary_meets_AA', () => {
    expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(AA);
  });
});

test('contrast_ratio_matches_known_values', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
});

test('follows_the_system_color_scheme', async () => {
  scheme.mockReturnValue('dark');
  const { result } = await renderHook(() => useTheme());
  expect(result.current.colors).toBe(palettes.dark);

  scheme.mockReturnValue(null);
  const { result: fallback } = await renderHook(() => useTheme());
  expect(fallback.current.colors).toBe(palettes.light);
});
