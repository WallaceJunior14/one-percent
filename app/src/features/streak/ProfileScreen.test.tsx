import { fireEvent, render, screen } from '@testing-library/react-native';

import { ProfileScreen, quizAverage } from './ProfileScreen';

const AREA_NAMES = { tech: 'Tecnologia', economy: 'Economia', health: 'Saúde' };
const TOTALS = { cards: 42, papers: 12, byArea: { tech: 20, economy: 15, health: 7 } };

async function renderScreen(props: Partial<Parameters<typeof ProfileScreen>[0]> = {}) {
  const onBack = jest.fn();
  await render(
    <ProfileScreen
      streak={{ current: 3, best: 8 }}
      totals={TOTALS}
      quizAveragePercent={67}
      areaNames={AREA_NAMES}
      onBack={onBack}
      {...props}
    />,
  );
  return onBack;
}

test('shows_current_and_best_streak', async () => {
  await renderScreen();

  expect(screen.getByRole('header', { name: 'Meu progresso' })).toBeOnTheScreen();
  expect(screen.getByText('3 dias seguidos')).toBeOnTheScreen();
  expect(screen.getByText('Maior sequência: 8 dias')).toBeOnTheScreen();
});

test('shows_total_cards_and_papers_read', async () => {
  await renderScreen();

  expect(screen.getByText('42')).toBeOnTheScreen();
  expect(screen.getByText('cards lidos')).toBeOnTheScreen();
  expect(screen.getByText('12')).toBeOnTheScreen();
  expect(screen.getByText('artigos científicos')).toBeOnTheScreen();
});

test('shows_distribution_by_area_from_most_to_least_read', async () => {
  await renderScreen();

  const labels = screen.getAllByTestId('area-row').map((row) => row.props.accessibilityLabel);
  expect(labels).toEqual([
    'Tecnologia: 20 cards, 48%',
    'Economia: 15 cards, 36%',
    'Saúde: 7 cards, 17%',
  ]);
});

test('shows_quiz_average', async () => {
  await renderScreen();

  expect(screen.getByText('Média no quiz: 67% de acertos')).toBeOnTheScreen();
});

test('explains_when_there_is_no_quiz_yet', async () => {
  await renderScreen({ quizAveragePercent: null });

  expect(screen.getByText('Média no quiz: nenhum quiz feito ainda')).toBeOnTheScreen();
});

test('invites_to_start_when_nothing_was_read', async () => {
  await renderScreen({
    streak: { current: 0, best: 0 },
    totals: { cards: 0, papers: 0, byArea: {} },
    quizAveragePercent: null,
  });

  expect(
    screen.getByText('Conclua seu primeiro dia para ver a distribuição por área.'),
  ).toBeOnTheScreen();
  expect(screen.queryAllByTestId('area-row')).toHaveLength(0);
});

test('back_button_leaves_the_profile', async () => {
  const onBack = await renderScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));

  expect(onBack).toHaveBeenCalledTimes(1);
});

describe('quizAverage', () => {
  test('is_null_without_history', () => {
    expect(quizAverage([])).toBeNull();
  });

  test('weights_by_number_of_questions', () => {
    const history = [
      { date: '2026-11-14', score: 3, total: 3 },
      { date: '2026-11-15', score: 0, total: 3 },
      { date: '2026-11-16', score: 1, total: 1 },
    ];

    // 4 acertos em 7 perguntas
    expect(quizAverage(history)).toBe(57);
  });
});
