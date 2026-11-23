import sampleDay from '../../../../contracts/examples/sample-day.json';
import { parseDailyContent } from '@/features/content/contract';
import type { Clock } from '@/shared/lib/dates';
import { createMemoryStore, readJson } from '@/test/fakes';
import { createSavedCardsRepository, SAVED_KEY } from './savedCards';

const cards = parseDailyContent(sampleDay).cards;
const [first, second, third] = cards;

function tickingClock(): Clock {
  let minute = 0;
  return { now: () => new Date(Date.UTC(2026, 10, 14, 10, minute++)) };
}

function newRepository(store = createMemoryStore()) {
  return createSavedCardsRepository(store, tickingClock());
}

test('starts_empty', async () => {
  expect(await newRepository().list()).toEqual([]);
});

test('toggle_saves_then_removes', async () => {
  const repository = newRepository();

  expect(await repository.toggle(first)).toBe(true);
  expect((await repository.list()).map((saved) => saved.card.id)).toEqual([first.id]);

  expect(await repository.toggle(first)).toBe(false);
  expect(await repository.list()).toEqual([]);
});

test('lists_newest_first', async () => {
  const repository = newRepository();
  await repository.toggle(first);
  await repository.toggle(second);
  await repository.toggle(third);

  expect((await repository.list()).map((saved) => saved.card.id)).toEqual([
    third.id,
    second.id,
    first.id,
  ]);
});

test('keeps_full_card_available_after_day_changes', async () => {
  const store = createMemoryStore();
  await newRepository(store).toggle(second);

  const [saved] = await newRepository(store).list();

  expect(saved.card).toEqual(second);
  expect(saved.savedAt).toMatch(/^2026-11-14T10:/);
});

test('reports_saved_ids', async () => {
  const repository = newRepository();
  await repository.toggle(first);

  expect(await repository.savedIds()).toEqual(new Set([first.id]));
});

test('corrupted_data_starts_empty', async () => {
  const repository = newRepository(createMemoryStore({ [SAVED_KEY]: '[{"card": 42}]' }));

  expect(await repository.list()).toEqual([]);
});

test('reads_cards_saved_by_the_previous_version', async () => {
  const legacy = [{ card: sampleDay.cards[0], savedAt: '2026-11-14T10:00:00.000Z' }];
  const store = createMemoryStore({ 'saved.v1': JSON.stringify(legacy) });

  expect(await newRepository(store).list()).toEqual(legacy);
  expect(await readJson(store, SAVED_KEY)).toEqual({ version: 2, data: legacy });
  expect(await readJson(store, 'saved.backup.v1')).toEqual(legacy);
});
