import { createMemoryStore, readJson } from '@/test/fakes';
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

test('accepts_areas_published_after_this_app_version', () => {
  expect(validatePreferences({ areaIds: ['arts'], subareaIds: ['arts.music'] })).toEqual({
    areaIds: ['arts'],
    subareaIds: ['arts.music'],
  });
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

test('reads_preferences_saved_by_the_previous_version', async () => {
  const legacy = '{"areaIds":["tech","health"],"subareaIds":["tech.ai"]}';
  const store = createMemoryStore({ 'preferences.v1': legacy });
  const expected = { areaIds: ['tech', 'health'], subareaIds: ['tech.ai'] };

  expect(await createPreferencesRepository(store).load()).toEqual(expected);
  expect(await readJson(store, PREFERENCES_KEY)).toEqual({ version: 2, data: expected });
  expect(await store.getItem('preferences.backup.v1')).toBe(legacy);
});

test('unreadable_preferences_are_preserved', async () => {
  const store = createMemoryStore({ [PREFERENCES_KEY]: '{"areaIds": [' });

  expect(await createPreferencesRepository(store).load()).toBeNull();
  expect(store.keys()).toEqual([expect.stringMatching(/^preferences\.unreadable\.\d+$/)]);
});
