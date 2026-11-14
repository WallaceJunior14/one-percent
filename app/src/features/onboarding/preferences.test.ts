import { createMemoryStore } from '@/test/fakes';
import {
  createPreferencesRepository,
  InvalidPreferencesError,
  PREFERENCES_KEY,
  validatePreferences,
} from './preferences';

test('requires_at_least_one_area', () => {
  expect(() => validatePreferences({ areaIds: [], subareaIds: [] })).toThrow(
    InvalidPreferencesError,
  );
});

test('rejects_unknown_area', () => {
  expect(() => validatePreferences({ areaIds: ['astrology'], subareaIds: [] })).toThrow(
    InvalidPreferencesError,
  );
});

test('drops_subareas_of_unselected_areas_and_duplicates', () => {
  const preferences = validatePreferences({
    areaIds: ['tech', 'tech'],
    subareaIds: ['tech.ai', 'health.mental', 'tech.ai'],
  });

  expect(preferences).toEqual({ areaIds: ['tech'], subareaIds: ['tech.ai'] });
});

test('persists_and_restores', async () => {
  const repository = createPreferencesRepository(createMemoryStore());

  await repository.save({ areaIds: ['tech', 'health'], subareaIds: ['health.mental'] });

  expect(await repository.load()).toEqual({
    areaIds: ['tech', 'health'],
    subareaIds: ['health.mental'],
  });
});

test('load_returns_null_before_onboarding', async () => {
  expect(await createPreferencesRepository(createMemoryStore()).load()).toBeNull();
});

test('load_returns_null_for_corrupted_data', async () => {
  const store = createMemoryStore({ [PREFERENCES_KEY]: '{"areaIds": []}' });

  expect(await createPreferencesRepository(store).load()).toBeNull();
});

test('save_rejects_invalid_preferences', async () => {
  const repository = createPreferencesRepository(createMemoryStore());

  await expect(repository.save({ areaIds: [], subareaIds: [] })).rejects.toThrow(
    InvalidPreferencesError,
  );
});
