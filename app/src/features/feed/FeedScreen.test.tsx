import { fireEvent, render, screen, within } from '@testing-library/react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { parseDailyContent } from '@/features/content/contract';
import { FeedScreen, updateSeenCount } from './FeedScreen';

const content = parseDailyContent(sampleDay);
const cards = content.cards.slice(0, 3);
const areaNames = Object.fromEntries(content.areas.map((area) => [area.id, area.name]));

async function setup(props: { stale?: boolean } = {}) {
  const onFinished = jest.fn();
  const onEditAreas = jest.fn();
  const onOpenSaved = jest.fn();
  const onToggleSave = jest.fn();
  await render(
    <FeedScreen
      cards={cards}
      areaNames={areaNames}
      savedIds={new Set([cards[1].id])}
      onFinished={onFinished}
      onEditAreas={onEditAreas}
      onOpenSaved={onOpenSaved}
      onToggleSave={onToggleSave}
      {...props}
    />,
  );
  return { onFinished, onEditAreas, onOpenSaved, onToggleSave };
}

test('lists_all_cards_in_one_column', async () => {
  await setup();

  for (const card of cards) {
    expect(screen.getByText(card.title)).toBeOnTheScreen();
  }
});

test('counts_cards_seen', () => {
  expect(updateSeenCount(0, [0, 1], 15)).toBe(2);
  expect(updateSeenCount(2, [3, 4, 5], 15)).toBe(6);
});

test('seen_count_never_decreases_or_exceeds_total', () => {
  expect(updateSeenCount(6, [0, 1], 15)).toBe(6);
  expect(updateSeenCount(6, [], 15)).toBe(6);
  expect(updateSeenCount(14, [15], 15)).toBe(15);
});

test('header_shows_areas_button_and_seen_progress', async () => {
  const { onEditAreas } = await setup();

  const header = within(screen.getByTestId('feed-header'));
  expect(header.getByText(/de 3 vistos$/)).toBeOnTheScreen();
  await fireEvent.press(header.getByRole('button', { name: 'Editar áreas' }));

  expect(onEditAreas).toHaveBeenCalledTimes(1);
});

test('finish_button_completes_the_day_once', async () => {
  const { onFinished } = await setup();

  expect(screen.getByText('Você chegou ao fim de hoje')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Concluir o dia' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Concluir o dia' }));

  expect(onFinished).toHaveBeenCalledTimes(1);
});

test('shows_warning_for_previous_day_content', async () => {
  await setup({ stale: true });

  expect(screen.getByText(/conteúdo de hoje ainda não chegou/i)).toBeOnTheScreen();
});

test('opens_and_closes_detail_on_card_press', async () => {
  await setup();
  const card = cards[0];
  expect(screen.queryByText(card.whyItMatters)).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: `Ler mais: ${card.title}` }));
  expect(screen.getByText(card.whyItMatters)).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
  expect(screen.queryByText(card.whyItMatters)).toBeNull();
});

test('header_opens_saved_cards', async () => {
  const { onOpenSaved } = await setup();

  await fireEvent.press(
    within(screen.getByTestId('feed-header')).getByRole('button', { name: 'Ver salvos' }),
  );

  expect(onOpenSaved).toHaveBeenCalledTimes(1);
});

test('saves_from_the_detail_panel', async () => {
  const { onToggleSave } = await setup();

  await fireEvent.press(screen.getByRole('button', { name: `Ler mais: ${cards[1].title}` }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remover dos salvos' }));

  expect(onToggleSave).toHaveBeenCalledWith(cards[1]);
});
