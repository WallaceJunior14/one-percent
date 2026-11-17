import { fireEvent, render, screen } from '@testing-library/react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { parseDailyContent } from '@/features/content/contract';
import { StoriesBar } from './StoriesBar';

const content = parseDailyContent(sampleDay);
const areaNames = Object.fromEntries(content.areas.map((area) => [area.id, area.name]));
const stories = content.stories.filter((story) => ['tech', 'health'].includes(story.areaId));

async function setup(seen = new Set<string>()) {
  const onOpen = jest.fn();
  await render(
    <StoriesBar stories={stories} areaNames={areaNames} seenAreaIds={seen} onOpen={onOpen} />,
  );
  return onOpen;
}

test('shows_one_circle_per_story', async () => {
  await setup();

  expect(screen.getAllByRole('button', { name: /^Story:/ })).toHaveLength(2);
  expect(screen.getByText('Tecnologia')).toBeOnTheScreen();
  expect(screen.getByText('Saúde')).toBeOnTheScreen();
});

test('marks_seen_stories', async () => {
  await setup(new Set(['tech']));

  expect(screen.getByRole('button', { name: 'Story: Tecnologia (visto)' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Story: Saúde' })).toBeOnTheScreen();
});

test('opens_story_on_press', async () => {
  const onOpen = await setup();

  await fireEvent.press(screen.getByRole('button', { name: 'Story: Saúde' }));

  expect(onOpen).toHaveBeenCalledWith('health');
});

test('renders_nothing_without_stories', async () => {
  await render(
    <StoriesBar stories={[]} areaNames={areaNames} seenAreaIds={new Set()} onOpen={jest.fn()} />,
  );

  expect(screen.queryByRole('button')).toBeNull();
});

test('circle_initial_grows_with_system_font_only_up_to_the_circle_size', async () => {
  await setup();

  expect(screen.getByText('T').props.maxFontSizeMultiplier).toBe(1.3);
});
