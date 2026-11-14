import { calculateStreak, previousDay } from './calculateStreak';

test('no_completed_days_means_no_streak', () => {
  expect(calculateStreak([], '2026-11-14')).toEqual({ current: 0, best: 0 });
});

test('first_completion_starts_at_1', () => {
  expect(calculateStreak(['2026-11-14'], '2026-11-14')).toEqual({ current: 1, best: 1 });
});

test('increments_when_yesterday_completed', () => {
  expect(calculateStreak(['2026-11-13', '2026-11-14'], '2026-11-14').current).toBe(2);
});

test('resets_to_1_after_gap', () => {
  expect(calculateStreak(['2026-11-10', '2026-11-11', '2026-11-14'], '2026-11-14')).toEqual({
    current: 1,
    best: 2,
  });
});

test('streak_stays_alive_until_today_ends', () => {
  // Concluiu até ontem e ainda não concluiu hoje: a sequência não está perdida.
  expect(calculateStreak(['2026-11-12', '2026-11-13'], '2026-11-14').current).toBe(2);
});

test('streak_is_lost_after_missing_a_whole_day', () => {
  expect(calculateStreak(['2026-11-11', '2026-11-12'], '2026-11-14').current).toBe(0);
});

test('same_day_does_not_change', () => {
  expect(calculateStreak(['2026-11-14', '2026-11-14'], '2026-11-14').current).toBe(1);
});

test('tracks_best_streak', () => {
  const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-11-13', '2026-11-14'];

  expect(calculateStreak(days, '2026-11-14')).toEqual({ current: 2, best: 4 });
});

test('handles_month_and_year_boundaries', () => {
  expect(previousDay('2026-03-01')).toBe('2026-02-28');
  expect(previousDay('2027-01-01')).toBe('2026-12-31');
  expect(calculateStreak(['2026-12-31', '2027-01-01'], '2027-01-01').current).toBe(2);
});
