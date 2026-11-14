import sampleDay from '../../../../contracts/examples/sample-day.json';
import { parseDailyContent } from '@/features/content/contract';
import type { Clock } from '@/shared/lib/dates';
import { createMemoryStore } from '@/test/fakes';
import { createProgressRepository, PROGRESS_KEY } from './progress';

const cards = parseDailyContent(sampleDay).cards;
const tech = cards.filter((c) => c.areaId === 'tech');
const economy = cards.filter((c) => c.areaId === 'economy');

function movableClock(start: Date): Clock & { set(date: Date): void } {
  let now = start;
  return { now: () => now, set: (date) => (now = date) };
}

test('starts_empty', async () => {
  const repository = createProgressRepository(createMemoryStore(), movableClock(new Date()));

  expect(await repository.load()).toEqual({
    completedDays: [],
    totals: { cards: 0, papers: 0, byArea: {} },
    lastDay: null,
  });
});

test('marks_day_complete', async () => {
  const repository = createProgressRepository(
    createMemoryStore(),
    movableClock(new Date(2026, 10, 14, 9, 0)),
  );

  const summary = await repository.completeDay([...tech, ...economy]);

  expect(summary).toEqual({
    date: '2026-11-14',
    cardsRead: tech.length + economy.length,
    papersRead: tech.filter((c) => c.type === 'paper').length,
    areaIds: ['tech', 'economy'],
  });
  expect((await repository.load()).completedDays).toEqual(['2026-11-14']);
});

test('counts_cards_by_area', async () => {
  const repository = createProgressRepository(
    createMemoryStore(),
    movableClock(new Date(2026, 10, 14, 9, 0)),
  );

  await repository.completeDay([...tech, ...economy]);

  expect((await repository.load()).totals).toEqual({
    cards: tech.length + economy.length,
    papers: tech.filter((c) => c.type === 'paper').length,
    byArea: { tech: tech.length, economy: economy.length },
  });
});

test('completing_twice_on_the_same_day_changes_nothing', async () => {
  const repository = createProgressRepository(
    createMemoryStore(),
    movableClock(new Date(2026, 10, 14, 9, 0)),
  );

  const first = await repository.completeDay(economy);
  const second = await repository.completeDay(economy);
  const progress = await repository.load();

  expect(second).toEqual(first);
  expect(progress.completedDays).toEqual(['2026-11-14']);
  expect(progress.totals.cards).toBe(economy.length);
});

test('uses_local_timezone_boundaries', async () => {
  const clock = movableClock(new Date(2026, 10, 14, 23, 59));
  const repository = createProgressRepository(createMemoryStore(), clock);

  await repository.completeDay(economy);
  clock.set(new Date(2026, 10, 15, 0, 1));
  await repository.completeDay(economy);

  expect((await repository.load()).completedDays).toEqual(['2026-11-14', '2026-11-15']);
});

test('persists_between_app_launches', async () => {
  const store = createMemoryStore();
  const clock = movableClock(new Date(2026, 10, 14, 9, 0));
  await createProgressRepository(store, clock).completeDay(economy);

  const reopened = await createProgressRepository(store, clock).load();

  expect(reopened.completedDays).toEqual(['2026-11-14']);
  expect(reopened.lastDay?.cardsRead).toBe(economy.length);
});

test('corrupted_data_starts_empty', async () => {
  const store = createMemoryStore({ [PROGRESS_KEY]: '{"completedDays": "nope"' });

  const progress = await createProgressRepository(store, movableClock(new Date())).load();

  expect(progress.completedDays).toEqual([]);
});
