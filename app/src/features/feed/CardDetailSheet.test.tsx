import { fireEvent, render, screen } from '@testing-library/react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { type Card, parseDailyContent } from '@/features/content/contract';
import { CardDetailSheet } from './CardDetailSheet';

const cards = parseDailyContent(sampleDay).cards;
const news = cards.find((c) => c.type === 'news')!;
const paper = cards.find((c) => c.type === 'paper')!;

async function renderSheet(card: Card | null, saved = false, onToggleSave = jest.fn()) {
  const onClose = jest.fn();
  await render(
    <CardDetailSheet
      card={card}
      areaName="Tecnologia"
      onClose={onClose}
      onOpenUrl={jest.fn()}
      saved={saved}
      onToggleSave={onToggleSave}
    />,
  );
  return onClose;
}

test('renders_full_news_detail_when_open', async () => {
  await renderSheet(news);

  expect(screen.getByText(news.whyItMatters)).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: 'Ler a matéria original' })).toBeOnTheScreen();
});

test('renders_full_paper_detail_when_open', async () => {
  await renderSheet(paper);

  expect(screen.getByText('Método')).toBeOnTheScreen();
  expect(screen.getByText(paper.type === 'paper' ? paper.limitations : '')).toBeOnTheScreen();
});

test('renders_nothing_when_closed', async () => {
  await renderSheet(null);

  expect(screen.queryByText(news.title)).toBeNull();
});

test('closes_with_button', async () => {
  const onClose = await renderSheet(news);

  await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));

  expect(onClose).toHaveBeenCalledTimes(1);
});

test('closes_with_android_back', async () => {
  const onClose = await renderSheet(news);

  await fireEvent(screen.getByTestId('card-detail-sheet'), 'requestClose');

  expect(onClose).toHaveBeenCalledTimes(1);
});

test('saves_the_open_card', async () => {
  const onToggleSave = jest.fn();
  await renderSheet(news, false, onToggleSave);

  await fireEvent.press(screen.getByRole('button', { name: 'Salvar card' }));

  expect(onToggleSave).toHaveBeenCalledWith(news);
});

test('shows_when_the_card_is_already_saved', async () => {
  await renderSheet(news, true);

  expect(screen.getByRole('button', { name: 'Remover dos salvos' })).toBeOnTheScreen();
  expect(screen.getByText('Salvo')).toBeOnTheScreen();
});
