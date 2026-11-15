import sampleDay from '../../../../contracts/examples/sample-day.json';
import { parseDailyContent } from '@/features/content/contract';
import type { Clock } from '@/shared/lib/dates';
import { createMemoryStore } from '@/test/fakes';
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
