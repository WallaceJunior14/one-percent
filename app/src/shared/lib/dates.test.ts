import { toLocalDateString } from './dates';

test('formats_local_date_as_iso_day', () => {
  expect(toLocalDateString(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05');
});

test('pads_month_and_day', () => {
  expect(toLocalDateString(new Date(2026, 0, 2, 0, 0))).toBe('2026-01-02');
});
