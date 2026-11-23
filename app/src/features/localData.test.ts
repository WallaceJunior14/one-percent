import sampleDay from '../../../contracts/examples/sample-day.json';
import { createPreferencesRepository } from '@/features/onboarding/preferences';
import { createQuizRepository } from '@/features/quiz/quizRepository';
import { createReminderService } from '@/features/reminders/reminderScheduler';
import { createSavedCardsRepository } from '@/features/saved/savedCards';
import { createSeenStoriesRepository } from '@/features/stories/seenStories';
import { createProgressRepository } from '@/features/streak/progress';
import { createMemoryStore, fixedClock } from '@/test/fakes';

const NOW = new Date(2026, 10, 14, 9, 0);

// Valores no formato que a versão 0.1.0 do app grava hoje no celular.
const PREVIOUS_VERSION_DATA = {
  'preferences.v1': JSON.stringify({ areaIds: ['tech', 'health'], subareaIds: [] }),
  'progress.v1': JSON.stringify({
    completedDays: ['2026-11-13'],
    totals: { cards: 15, papers: 5, byArea: { tech: 8, health: 7 } },
    lastDay: { date: '2026-11-13', cardsRead: 15, papersRead: 5, areaIds: ['tech', 'health'] },
  }),
  'saved.v1': JSON.stringify([{ card: sampleDay.cards[0], savedAt: '2026-11-13T10:00:00.000Z' }]),
  'quiz.v1': JSON.stringify({
    current: { date: '2026-11-13', questions: sampleDay.cards.slice(0, 3), score: 2 },
    history: [{ date: '2026-11-13', score: 2, total: 3 }],
  }),
  'stories.seen.v1': JSON.stringify({ date: '2026-11-14', areaIds: ['tech'] }),
  'reminder.v1': JSON.stringify({ enabled: true, hour: 7, minute: 30 }),
};

function repositoriesOver(store: ReturnType<typeof createMemoryStore>) {
  const clock = fixedClock(NOW);
  const progress = createProgressRepository(store, clock);
  return {
    preferences: createPreferencesRepository(store, clock),
    progress,
    saved: createSavedCardsRepository(store, clock),
    quiz: createQuizRepository(store, clock),
    seenStories: createSeenStoriesRepository(store, clock),
    reminders: createReminderService({
      store,
      progress,
      clock,
      scheduler: {
        requestPermission: async () => true,
        cancelAll: async () => {},
        schedule: async () => {},
      },
    }),
  };
}

test('keeps_other_keys_when_one_is_unreadable', async () => {
  const store = createMemoryStore({ ...PREVIOUS_VERSION_DATA, 'saved.v1': '[{"card": 42}]' });
  const repositories = repositoriesOver(store);

  expect(await repositories.saved.list()).toEqual([]);

  expect(await repositories.preferences.load()).toEqual({
    areaIds: ['tech', 'health'],
    subareaIds: [],
  });
  expect((await repositories.progress.load()).completedDays).toEqual(['2026-11-13']);
  expect(await repositories.quiz.history()).toEqual([{ date: '2026-11-13', score: 2, total: 3 }]);
  expect(await repositories.seenStories.seenToday()).toEqual(new Set(['tech']));
  expect(await repositories.reminders.settings()).toEqual({ enabled: true, hour: 7, minute: 30 });
  expect(await store.getItem(`saved.unreadable.${NOW.getTime()}`)).toBe('[{"card": 42}]');
});

test('reopening_after_migration_reads_the_same_data', async () => {
  const store = createMemoryStore(PREVIOUS_VERSION_DATA);
  const first = repositoriesOver(store);
  const before = {
    progress: await first.progress.load(),
    saved: await first.saved.list(),
    history: await first.quiz.history(),
  };

  const reopened = repositoriesOver(store);

  expect(await reopened.progress.load()).toEqual(before.progress);
  expect(await reopened.saved.list()).toEqual(before.saved);
  expect(await reopened.quiz.history()).toEqual(before.history);
  for (const legacyKey of ['progress.v1', 'saved.v1', 'quiz.v1']) {
    expect(await store.getItem(legacyKey)).toBeNull();
  }
});
