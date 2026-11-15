import { fireEvent, render, screen } from '@testing-library/react-native';

import { DayCompleteScreen } from './DayCompleteScreen';

const AREA_NAMES = { tech: 'Tecnologia', economy: 'Economia', health: 'Saúde' };
const SUMMARY = { date: '2026-11-14', cardsRead: 15, papersRead: 6, areaIds: ['tech', 'economy'] };

async function renderScreen(
  streak = { current: 3, best: 5 },
  onReview = jest.fn(),
  quiz: { score: number | null; total: number } | null = null,
  onStartQuiz = jest.fn(),
) {
  await render(
    <DayCompleteScreen
      summary={SUMMARY}
      streak={streak}
      areaNames={AREA_NAMES}
      onReview={onReview}
      quiz={quiz}
      onStartQuiz={onStartQuiz}
    />,
  );
  return onReview;
}

test('shows_cards_read_and_areas_covered', async () => {
  await renderScreen();

  expect(screen.getByRole('header', { name: 'Dia concluído' })).toBeOnTheScreen();
  expect(screen.getByText('15')).toBeOnTheScreen();
  expect(screen.getByText('cards lidos')).toBeOnTheScreen();
  expect(screen.getByText('6')).toBeOnTheScreen();
  expect(screen.getByText('artigos científicos')).toBeOnTheScreen();
  expect(screen.getByText('Tecnologia · Economia')).toBeOnTheScreen();
});

test('shows_current_streak_in_plural', async () => {
  await renderScreen({ current: 3, best: 5 });

  expect(screen.getByText('3 dias seguidos')).toBeOnTheScreen();
});

test('shows_current_streak_in_singular', async () => {
  await renderScreen({ current: 1, best: 1 });

  expect(screen.getByText('1 dia seguido')).toBeOnTheScreen();
});

test('shows_best_streak', async () => {
  await renderScreen({ current: 3, best: 5 });

  expect(screen.getByText('Maior sequência: 5 dias')).toBeOnTheScreen();
});

test('review_button_goes_back_to_the_cards', async () => {
  const onReview = await renderScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Rever os cards' }));

  expect(onReview).toHaveBeenCalledTimes(1);
});

test('offers_the_quiz_when_not_answered_yet', async () => {
  const onStartQuiz = jest.fn();
  await renderScreen(undefined, undefined, { score: null, total: 3 }, onStartQuiz);

  await fireEvent.press(screen.getByRole('button', { name: 'Fazer o quiz (3 perguntas)' }));

  expect(onStartQuiz).toHaveBeenCalledTimes(1);
});

test('shows_quiz_score_once_answered', async () => {
  await renderScreen(undefined, undefined, { score: 2, total: 3 });

  expect(screen.getByText('Quiz: 2 de 3 acertos')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /Fazer o quiz/ })).toBeNull();
});

test('hides_quiz_when_there_is_none', async () => {
  await renderScreen();

  expect(screen.queryByText(/quiz/i)).toBeNull();
});
