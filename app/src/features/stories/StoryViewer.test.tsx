import { act, fireEvent, render, screen } from '@testing-library/react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { parseDailyContent } from '@/features/content/contract';
import { SLIDE_DURATION_MS, StoryViewer } from './StoryViewer';

const content = parseDailyContent(sampleDay);
const story = content.stories.find((s) => s.areaId === 'science')!; // 3 slides
const slides = story.slides;

async function setup() {
  const callbacks = { onFinished: jest.fn(), onClose: jest.fn(), onOpenCard: jest.fn() };
  await render(<StoryViewer story={story} areaName="Ciência" {...callbacks} />);
  return callbacks;
}

afterEach(() => jest.useRealTimers());

test('shows_first_slide_and_progress', async () => {
  await setup();

  expect(screen.getByText(slides[0].headline)).toBeOnTheScreen();
  expect(screen.getByText('1 de 3')).toBeOnTheScreen();
  expect(screen.getByText('Ciência')).toBeOnTheScreen();
});

test('advances_on_right_tap_and_goes_back_on_left_tap', async () => {
  await setup();

  await fireEvent.press(screen.getByRole('button', { name: 'Próxima manchete' }));
  expect(screen.getByText(slides[1].headline)).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Manchete anterior' }));
  expect(screen.getByText(slides[0].headline)).toBeOnTheScreen();
});

test('finishes_after_the_last_slide', async () => {
  const { onFinished } = await setup();

  for (let i = 0; i < slides.length; i++) {
    await fireEvent.press(screen.getByRole('button', { name: 'Próxima manchete' }));
  }

  expect(onFinished).toHaveBeenCalledTimes(1);
});

test('advances_automatically', async () => {
  jest.useFakeTimers();
  await setup();

  await act(async () => {
    jest.advanceTimersByTime(SLIDE_DURATION_MS);
  });

  expect(screen.getByText(slides[1].headline)).toBeOnTheScreen();
});

test('opens_the_card_of_the_current_slide', async () => {
  const { onOpenCard } = await setup();

  await fireEvent.press(screen.getByRole('button', { name: 'Ler o card' }));

  expect(onOpenCard).toHaveBeenCalledWith(slides[0].cardId);
});

test('closes_without_finishing', async () => {
  const { onClose, onFinished } = await setup();

  await fireEvent.press(screen.getByRole('button', { name: 'Fechar story' }));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onFinished).not.toHaveBeenCalled();
});
