import { fireEvent, render, screen } from '@testing-library/react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { type Card, parseDailyContent } from '@/features/content/contract';
import { CardPreview, TEASER_LINES } from './CardPreview';

const cards = parseDailyContent(sampleDay).cards;
const news = cards.find((c) => c.id === 'c_000000000001')!;
const paper = cards.find((c) => c.id === 'c_000000000003')!; // preprint, et al.

async function renderPreview(card: Card, onOpen = jest.fn()) {
  await render(<CardPreview card={card} areaName="Tecnologia" onOpen={onOpen} />);
  return onOpen;
}

test('shows_essentials_and_teaser', async () => {
  await renderPreview(news);

  expect(screen.getByText('Tecnologia')).toBeOnTheScreen();
  expect(screen.getByText(news.title)).toBeOnTheScreen();
  expect(screen.getByText(/Exemplo Tech · 31 de out\./)).toBeOnTheScreen();
  expect(screen.getByText(news.summary)).toBeOnTheScreen();
  expect(screen.getByText('Toque para ler mais')).toBeOnTheScreen();
});

test('teaser_is_limited_to_a_few_lines', async () => {
  await renderPreview(news);

  expect(screen.getByText(news.summary).props.numberOfLines).toBe(TEASER_LINES);
});

test('leaves_full_details_for_the_panel', async () => {
  await renderPreview(paper);

  expect(screen.queryByText('Por que importa')).toBeNull();
  expect(screen.queryByText('Método')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
});

test('paper_preview_shows_badges_and_authors', async () => {
  await renderPreview(paper);

  expect(screen.getByText('Artigo científico')).toBeOnTheScreen();
  expect(screen.getByText('Preprint — não revisado por pares')).toBeOnTheScreen();
  expect(screen.getByText(/et al\. · arXiv/)).toBeOnTheScreen();
});

test('opens_detail_on_press', async () => {
  const onOpen = await renderPreview(news);

  await fireEvent.press(screen.getByRole('button', { name: `Ler mais: ${news.title}` }));

  expect(onOpen).toHaveBeenCalledWith(news);
});
