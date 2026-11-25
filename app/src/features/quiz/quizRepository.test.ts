import sampleDay from '../../../../contracts/examples/sample-day.json';
import { parseDailyContent } from '@/features/content/contract';
import type { Clock } from '@/shared/lib/dates';
import { createMemoryStore, readJson } from '@/test/fakes';
import { createQuizRepository, QUIZ_KEY } from './quizRepository';

const cards = parseDailyContent(sampleDay).cards;
const questions = cards.slice(0, 3);

function movableClock(start: Date): Clock & { set(date: Date): void } {
  let now = start;
  return { now: () => now, set: (date) => (now = date) };
}

const NOV_14 = new Date(2026, 10, 14, 21, 0);

test('nothing_prepared_at_first', async () => {
  const repository = createQuizRepository(createMemoryStore(), movableClock(NOV_14));

  expect(await repository.today()).toBeNull();
});

test('prepares_todays_quiz', async () => {
  const repository = createQuizRepository(createMemoryStore(), movableClock(NOV_14));

  await repository.prepare(questions);

  expect(await repository.today()).toEqual({ date: '2026-11-14', questions, score: null });
});

test('preparing_again_on_the_same_day_keeps_the_first_questions', async () => {
  const repository = createQuizRepository(createMemoryStore(), movableClock(NOV_14));

  await repository.prepare(questions);
  await repository.prepare(cards.slice(5, 8));

  expect((await repository.today())?.questions).toEqual(questions);
});

test('records_score_in_history', async () => {
  const repository = createQuizRepository(createMemoryStore(), movableClock(NOV_14));
  await repository.prepare(questions);

  await repository.recordScore(2);

  expect((await repository.today())?.score).toBe(2);
  expect(await repository.history()).toEqual([{ date: '2026-11-14', score: 2, total: 3 }]);
});

test('yesterdays_quiz_is_not_today', async () => {
  const clock = movableClock(NOV_14);
  const repository = createQuizRepository(createMemoryStore(), clock);
  await repository.prepare(questions);

  clock.set(new Date(2026, 10, 15, 8, 0));

  expect(await repository.today()).toBeNull();
});

test('keeps_history_across_days', async () => {
  const clock = movableClock(NOV_14);
  const repository = createQuizRepository(createMemoryStore(), clock);
  await repository.prepare(questions);
  await repository.recordScore(3);
  clock.set(new Date(2026, 10, 15, 21, 0));
  await repository.prepare(questions);
  await repository.recordScore(1);

  expect(await repository.history()).toEqual([
    { date: '2026-11-14', score: 3, total: 3 },
    { date: '2026-11-15', score: 1, total: 3 },
  ]);
});

test('corrupted_data_starts_empty', async () => {
  const store = createMemoryStore({ [QUIZ_KEY]: '{"current": 1}' });
  const repository = createQuizRepository(store, movableClock(NOV_14));

  expect(await repository.today()).toBeNull();
  expect(await repository.history()).toEqual([]);
});

test('reads_quiz_saved_by_the_previous_version', async () => {
  const legacy = {
    current: { date: '2026-11-14', questions: sampleDay.cards.slice(0, 3), score: null },
    history: [{ date: '2026-11-13', score: 2, total: 3 }],
  };
  const store = createMemoryStore({ 'quiz.v1': JSON.stringify(legacy) });
  const repository = createQuizRepository(store, movableClock(NOV_14));

  expect(await repository.today()).toEqual({ date: '2026-11-14', questions, score: null });
  expect(await repository.history()).toEqual(legacy.history);
  expect(await readJson(store, QUIZ_KEY)).toEqual({ version: 2, data: legacy });
  expect(await readJson(store, 'quiz.backup.v1')).toEqual(legacy);
});

test('an_invalid_question_does_not_take_the_history_with_it', async () => {
  const history = [{ date: '2026-11-13', score: 2, total: 3 }];
  const broken = { ...sampleDay.cards[0], title: '' };
  const store = createMemoryStore({
    [QUIZ_KEY]: JSON.stringify({
      version: 2,
      data: { current: { date: '2026-11-14', questions: [broken], score: null }, history },
    }),
  });
  const repository = createQuizRepository(store, movableClock(NOV_14));

  expect(await repository.history()).toEqual(history);
  expect(await repository.today()).toBeNull();
  expect(store.keys().filter((key) => key.includes('unreadable'))).toEqual([]);
});
