import { fireEvent, render, screen } from '@testing-library/react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { type PaperCard as PaperCardData, parseDailyContent } from '@/features/content/contract';
import { PaperCard } from './PaperCard';

const papers = parseDailyContent(sampleDay).cards.filter(
  (c): c is PaperCardData => c.type === 'paper',
);
const preprint = papers.find((p) => p.id === 'c_000000000003')!; // 3 autores + et al., com PDF
const published = papers.find((p) => p.id === 'c_000000000004')!; // revisado, sem PDF

async function renderCard(card: PaperCardData, onOpenUrl = jest.fn()) {
  await render(<PaperCard card={card} areaName="Tecnologia" onOpenUrl={onOpenUrl} />);
  return onOpenUrl;
}

test('renders_paper_fields', async () => {
  await renderCard(preprint);

  expect(screen.getByText('Artigo científico')).toBeOnTheScreen();
  expect(screen.getByText(preprint.title)).toBeOnTheScreen();
  expect(screen.getByText(preprint.originalTitle)).toBeOnTheScreen();
  expect(screen.getByText(preprint.summary)).toBeOnTheScreen();
  for (const label of ['Método', 'Resultado', 'Limitações']) {
    expect(screen.getByText(label)).toBeOnTheScreen();
  }
  expect(screen.getByText(preprint.method)).toBeOnTheScreen();
  expect(screen.getByText(preprint.result)).toBeOnTheScreen();
  expect(screen.getByText(preprint.limitations)).toBeOnTheScreen();
});

test('shows_preprint_badge', async () => {
  await renderCard(preprint);

  expect(screen.getByText('Preprint — não revisado por pares')).toBeOnTheScreen();
});

test('hides_preprint_badge_for_peer_reviewed_paper', async () => {
  await renderCard(published);

  expect(screen.queryByText(/Preprint/)).toBeNull();
});

test('truncates_authors_with_et_al', async () => {
  await renderCard(preprint);

  expect(
    screen.getByText(`${preprint.authors.join(', ')} et al. · ${preprint.venue}`),
  ).toBeOnTheScreen();
});

test('lists_all_authors_when_not_truncated', async () => {
  await renderCard(published);

  expect(
    screen.getByText(`${published.authors.join(', ')} · ${published.venue}`),
  ).toBeOnTheScreen();
});

test('opens_article_and_pdf_links', async () => {
  const onOpenUrl = await renderCard(preprint);

  await fireEvent.press(screen.getByRole('link', { name: 'Ler o artigo' }));
  await fireEvent.press(screen.getByRole('link', { name: 'Abrir o PDF' }));

  expect(onOpenUrl.mock.calls).toEqual([[preprint.url], [preprint.pdfUrl]]);
});

test('hides_pdf_link_when_missing', async () => {
  await renderCard(published);

  expect(screen.queryByRole('link', { name: 'Abrir o PDF' })).toBeNull();
});
