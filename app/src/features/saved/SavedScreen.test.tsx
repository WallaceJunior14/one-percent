import { fireEvent, render, screen } from '@testing-library/react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { parseDailyContent } from '@/features/content/contract';
import type { SavedCard } from './savedCards';
import { SavedScreen } from './SavedScreen';

const content = parseDailyContent(sampleDay);
const areaNames = Object.fromEntries(content.areas.map((area) => [area.id, area.name]));
const tech = content.cards.find((c) => c.areaId === 'tech')!;
const health = content.cards.find((c) => c.areaId === 'health')!;
const ITEMS: SavedCard[] = [
  { card: health, savedAt: '2026-11-14T10:05:00.000Z' },
  { card: tech, savedAt: '2026-11-14T10:01:00.000Z' },
];

async function renderScreen(items = ITEMS) {
  const callbacks = { onToggleSave: jest.fn(), onBack: jest.fn() };
  await render(<SavedScreen items={items} areaNames={areaNames} {...callbacks} />);
  return callbacks;
}

test('lists_saved_cards_in_given_order', async () => {
  await renderScreen();

  const titles = screen.getAllByRole('button', { name: /^Ler mais:/ });
  expect(titles.map((t) => t.props.accessibilityLabel)).toEqual([
    `Ler mais: ${health.title}`,
    `Ler mais: ${tech.title}`,
  ]);
});

test('filters_by_area', async () => {
  await renderScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Filtrar: Saúde' }));

  expect(screen.getByText(health.title)).toBeOnTheScreen();
  expect(screen.queryByText(tech.title)).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Filtrar: Todas' }));
  expect(screen.getByText(tech.title)).toBeOnTheScreen();
});

test('shows_empty_state', async () => {
  await renderScreen([]);

  expect(screen.getByText('Nenhum card salvo ainda')).toBeOnTheScreen();
});

test('removes_from_saved_via_detail_panel', async () => {
  const { onToggleSave } = await renderScreen();

  await fireEvent.press(screen.getByRole('button', { name: `Ler mais: ${tech.title}` }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remover dos salvos' }));

  expect(onToggleSave).toHaveBeenCalledWith(tech);
});

test('goes_back', async () => {
  const { onBack } = await renderScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));

  expect(onBack).toHaveBeenCalledTimes(1);
});
