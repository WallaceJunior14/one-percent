import { fireEvent, render, screen } from '@testing-library/react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { parseDailyContent } from '@/features/content/contract';
import { FeedScreen } from './FeedScreen';

const content = parseDailyContent(sampleDay);
const cards = content.cards.slice(0, 3);
const areaNames = Object.fromEntries(content.areas.map((area) => [area.id, area.name]));
const PAGE_HEIGHT = 800;

async function setup(props: { stale?: boolean } = {}) {
  const onFinished = jest.fn();
  await render(
    <FeedScreen cards={cards} areaNames={areaNames} onFinished={onFinished} {...props} />,
  );
  const list = screen.getByTestId('feed-list');
  await fireEvent(list, 'layout', { nativeEvent: { layout: { width: 400, height: PAGE_HEIGHT } } });
  const scrollToPage = (page: number) =>
    fireEvent(list, 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: 0, y: page * PAGE_HEIGHT },
        layoutMeasurement: { width: 400, height: PAGE_HEIGHT },
        contentSize: { width: 400, height: (cards.length + 1) * PAGE_HEIGHT },
      },
    });
  return { onFinished, scrollToPage };
}

test('shows_one_card_per_page_starting_with_the_first', async () => {
  await setup();

  expect(screen.getByText(cards[0].title)).toBeOnTheScreen();
  expect(screen.getByText('1 de 3')).toBeOnTheScreen();
});

test('updates_progress_when_scrolling', async () => {
  const { scrollToPage } = await setup();

  await scrollToPage(1);

  expect(screen.getByText('2 de 3')).toBeOnTheScreen();
});

test('does_not_finish_on_the_last_card', async () => {
  const { onFinished, scrollToPage } = await setup();

  await scrollToPage(cards.length - 1);

  expect(onFinished).not.toHaveBeenCalled();
});

test('navigates_to_day_complete_after_last_card', async () => {
  const { onFinished, scrollToPage } = await setup();

  await scrollToPage(cards.length);
  await scrollToPage(cards.length);

  expect(onFinished).toHaveBeenCalledTimes(1);
});

test('end_page_offers_an_accessible_button', async () => {
  const { onFinished } = await setup();

  await fireEvent.press(screen.getByRole('button', { name: 'Ver o resumo do dia' }));

  expect(onFinished).toHaveBeenCalledTimes(1);
});

test('shows_warning_for_previous_day_content', async () => {
  await setup({ stale: true });

  expect(screen.getByText(/conteúdo de hoje ainda não chegou/i)).toBeOnTheScreen();
});
