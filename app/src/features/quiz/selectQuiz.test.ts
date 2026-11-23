import sampleDay from '../../../../contracts/examples/sample-day.json';
import { parseDailyContent } from '@/features/content/contract';
import { QUIZ_SIZE, selectQuiz } from './selectQuiz';

const cards = parseDailyContent(sampleDay).cards;
const byArea = (areaId: string) => cards.filter((card) => card.areaId === areaId);

test('picks_3_from_different_areas', () => {
  const feed = [...byArea('tech').slice(0, 3), ...byArea('economy'), ...byArea('health')];

  const quiz = selectQuiz(feed);

  expect(quiz).toHaveLength(QUIZ_SIZE);
  expect(new Set(quiz.map((card) => card.areaId)).size).toBe(3);
});

test('follows_feed_order_within_the_area_rotation', () => {
  const feed = [...byArea('economy'), ...byArea('tech')];

  expect(selectQuiz(feed).map((card) => card.id)).toEqual([
    byArea('economy')[0].id,
    byArea('tech')[0].id,
    byArea('economy')[1].id,
  ]);
});

test('fills_from_the_same_area_when_feed_has_one_area', () => {
  const quiz = selectQuiz(byArea('finance'));

  expect(quiz.map((card) => card.id)).toEqual(
    byArea('finance')
      .slice(0, 3)
      .map((c) => c.id),
  );
});

test('returns_fewer_when_feed_is_small', () => {
  expect(selectQuiz(byArea('finance').slice(0, 2))).toHaveLength(2);
});

test('same_input_same_output', () => {
  expect(selectQuiz(cards)).toEqual(selectQuiz(cards));
});

test('uses_configured_question_count', () => {
  expect(selectQuiz(cards, 5)).toHaveLength(5);
});
