import { quizAverage } from './quizStats';

test('is_null_without_history', () => {
  expect(quizAverage([])).toBeNull();
});

test('weights_by_number_of_questions', () => {
  const history = [
    { date: '2026-11-14', score: 3, total: 3 },
    { date: '2026-11-15', score: 0, total: 3 },
    { date: '2026-11-16', score: 1, total: 1 },
  ];

  expect(quizAverage(history)).toBe(57);
});
