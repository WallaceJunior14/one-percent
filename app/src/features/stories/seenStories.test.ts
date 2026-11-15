import type { Clock } from '@/shared/lib/dates';
import { createMemoryStore } from '@/test/fakes';
import { createSeenStoriesRepository } from './seenStories';

function movableClock(start: Date): Clock & { set(date: Date): void } {
  let now = start;
  return { now: () => now, set: (date) => (now = date) };
}

test('nothing_seen_at_first', async () => {
  const repository = createSeenStoriesRepository(createMemoryStore(), movableClock(new Date()));

  expect(await repository.seenToday()).toEqual(new Set());
});

test('marks_story_as_seen_today', async () => {
  const repository = createSeenStoriesRepository(
    createMemoryStore(),
    movableClock(new Date(2026, 10, 14, 9, 0)),
  );

  await repository.markSeen('tech');
  await repository.markSeen('tech');
  await repository.markSeen('health');

  expect(await repository.seenToday()).toEqual(new Set(['tech', 'health']));
});

test('resets_on_the_next_day', async () => {
  const clock = movableClock(new Date(2026, 10, 14, 23, 0));
  const repository = createSeenStoriesRepository(createMemoryStore(), clock);
  await repository.markSeen('tech');

  clock.set(new Date(2026, 10, 15, 7, 0));

  expect(await repository.seenToday()).toEqual(new Set());
});
