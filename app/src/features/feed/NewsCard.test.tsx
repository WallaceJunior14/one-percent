import { fireEvent, render, screen } from '@testing-library/react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { type NewsCard as NewsCardData, parseDailyContent } from '@/features/content/contract';
import { NewsCard } from './NewsCard';

const card = parseDailyContent(sampleDay).cards.find(
  (c): c is NewsCardData => c.id === 'c_000000000001',
)!;

test('renders_all_fields', async () => {
  await render(<NewsCard card={card} areaName="Tecnologia" onOpenUrl={jest.fn()} />);

  expect(screen.getByText('Tecnologia')).toBeOnTheScreen();
  expect(screen.getByText(card.title)).toBeOnTheScreen();
  expect(screen.getByText(card.summary)).toBeOnTheScreen();
  expect(screen.getByText(card.whyItMatters)).toBeOnTheScreen();
  expect(screen.getByText(/Por que importa/)).toBeOnTheScreen();
  expect(screen.getByText(new RegExp(card.sourceName))).toBeOnTheScreen();
  expect(screen.getByText(/out\./)).toBeOnTheScreen();
});

test('opens_original_link', async () => {
  const onOpenUrl = jest.fn();
  await render(<NewsCard card={card} areaName="Tecnologia" onOpenUrl={onOpenUrl} />);

  await fireEvent.press(screen.getByRole('link', { name: 'Ler a matéria original' }));

  expect(onOpenUrl).toHaveBeenCalledWith(card.url);
});
