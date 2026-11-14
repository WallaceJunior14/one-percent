import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { ContentUnavailableError, type ContentApi } from '@/features/content/contentApi';
import { type DailyContent, parseDailyContent } from '@/features/content/contract';
import { createPreferencesRepository, type Preferences } from '@/features/onboarding/preferences';
import { createProgressRepository } from '@/features/streak/progress';
import {
  contentApiFailing,
  contentApiReturning,
  createMemoryStore,
  fixedClock,
} from '@/test/fakes';
import { DailyFeed, type DailyFeedDependencies } from './DailyFeed';

const SAMPLE = parseDailyContent(sampleDay); // date: 2026-11-01
const TODAY = fixedClock(new Date(2026, 10, 1, 8, 0));
const ALL: Preferences = {
  areaIds: ['tech', 'science', 'economy', 'finance', 'health'],
  subareaIds: [],
};

async function setup({
  api = contentApiReturning(SAMPLE),
  preferences = ALL as Preferences | null,
  clock = TODAY,
}: {
  api?: ContentApi;
  preferences?: Preferences | null;
  clock?: ReturnType<typeof fixedClock>;
} = {}) {
  const repository = createPreferencesRepository(createMemoryStore());
  if (preferences) await repository.save(preferences);
  const progress = createProgressRepository(createMemoryStore(), clock);
  const deps: DailyFeedDependencies = {
    api,
    cache: createMemoryStore(),
    clock,
    preferences: repository,
    progress,
  };
  const callbacks = { onNeedOnboarding: jest.fn(), onFinished: jest.fn(), onEditAreas: jest.fn() };
  await render(<DailyFeed deps={deps} {...callbacks} />);
  return { ...callbacks, progress };
}

test('shows_feed_after_loading', async () => {
  await setup();

  expect(await screen.findByTestId('feed-list')).toBeOnTheScreen();
  expect(screen.getByText(/de 15 vistos$/)).toBeOnTheScreen();
});

test('redirects_to_onboarding_without_preferences', async () => {
  const { onNeedOnboarding } = await setup({ preferences: null });

  await screen.findByTestId('daily-feed-redirect');
  expect(onNeedOnboarding).toHaveBeenCalledTimes(1);
});

test('feed_has_only_selected_areas', async () => {
  await setup({ preferences: { areaIds: ['economy'], subareaIds: [] } });

  await screen.findByTestId('feed-list');
  const economyTitles = SAMPLE.cards.filter((c) => c.areaId === 'economy').map((c) => c.title);
  expect(screen.getByText(economyTitles[0])).toBeOnTheScreen();
  expect(screen.getByText(/de 3 vistos$/)).toBeOnTheScreen();
});

test('shows_warning_with_previous_day_content', async () => {
  await setup({ clock: fixedClock(new Date(2026, 10, 2, 8, 0)) });

  expect(await screen.findByText(/conteúdo de hoje ainda não chegou/i)).toBeOnTheScreen();
});

test('empty_state_offers_retry', async () => {
  let online = false;
  const api: ContentApi = {
    fetchLatest: async (): Promise<DailyContent> => {
      if (!online) throw new ContentUnavailableError('sem rede');
      return SAMPLE;
    },
  };
  await setup({ api });

  const retry = await screen.findByRole('button', { name: 'Tentar de novo' });
  expect(screen.getByText(/não foi possível carregar/i)).toBeOnTheScreen();

  online = true;
  await fireEvent.press(retry);

  expect(await screen.findByTestId('feed-list')).toBeOnTheScreen();
});

test('offers_editing_areas', async () => {
  const { onEditAreas } = await setup();

  await fireEvent.press(await screen.findByRole('button', { name: 'Editar áreas' }));

  expect(onEditAreas).toHaveBeenCalledTimes(1);
});

test('empty_state_on_first_access_without_internet', async () => {
  const api = contentApiFailing(new ContentUnavailableError('x'));
  await setup({ api });

  expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen();
});

test('completing_the_day_records_progress_before_leaving', async () => {
  const { onFinished, progress } = await setup();

  await fireEvent.press(await screen.findByRole('button', { name: 'Concluir o dia' }));

  await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  const saved = await progress.load();
  expect(saved.completedDays).toEqual(['2026-11-01']);
  expect(saved.lastDay?.cardsRead).toBe(15);
});
