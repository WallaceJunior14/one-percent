import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { ContentUnavailableError, type ContentApi } from '@/features/content/contentApi';
import {
  type DailyContent,
  parseDailyContent,
  UnsupportedContentVersionError,
} from '@/features/content/contract';
import { CONTENT_CACHE_KEY } from '@/features/content/resolveContent';
import { createPreferencesRepository, type Preferences } from '@/features/onboarding/preferences';
import { createQuizRepository } from '@/features/quiz/quizRepository';
import { createSavedCardsRepository } from '@/features/saved/savedCards';
import { createSeenStoriesRepository } from '@/features/stories/seenStories';
import { createProgressRepository } from '@/features/streak/progress';
import {
  contentApiFailing,
  contentApiReturning,
  createMemoryStore,
  fixedClock,
} from '@/test/fakes';
import { DailyFeed, type DailyFeedDependencies } from './DailyFeed';

// O padrão de 1 s do `findBy*` é curto para o primeiro render com a suíte rodando em paralelo.
configure({ asyncUtilTimeout: 5000 });

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
  reminderRefresh = async () => {},
  cache = createMemoryStore(),
}: {
  cache?: ReturnType<typeof createMemoryStore>;
  reminderRefresh?: () => Promise<void>;
  api?: ContentApi;
  preferences?: Preferences | null;
  clock?: ReturnType<typeof fixedClock>;
} = {}) {
  const repository = createPreferencesRepository(createMemoryStore());
  if (preferences) await repository.save(preferences);
  const progress = createProgressRepository(createMemoryStore(), clock);
  const saved = createSavedCardsRepository(createMemoryStore(), clock);
  const quiz = createQuizRepository(createMemoryStore(), clock);
  const seenStories = createSeenStoriesRepository(createMemoryStore(), clock);
  const reminders = { refresh: jest.fn(reminderRefresh) };
  const deps: DailyFeedDependencies = {
    api,
    cache,
    clock,
    preferences: repository,
    progress,
    saved,
    quiz,
    seenStories,
    reminders,
  };
  const callbacks = {
    onNeedOnboarding: jest.fn(),
    onFinished: jest.fn(),
    onEditAreas: jest.fn(),
    onOpenSaved: jest.fn(),
    onOpenProfile: jest.fn(),
  };
  await render(<DailyFeed deps={deps} {...callbacks} />);
  return { ...callbacks, progress, saved, quiz, reminders };
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
  await setup({ clock: fixedClock(new Date(2026, 10, 3, 8, 0)) });

  expect(await screen.findByText(/conteúdo de hoje ainda não chegou/i)).toBeOnTheScreen();
});

test('suggests_updating_the_app', async () => {
  await setup({
    api: contentApiFailing(new UnsupportedContentVersionError(2)),
    cache: createMemoryStore({ [CONTENT_CACHE_KEY]: JSON.stringify(SAMPLE) }),
    clock: fixedClock(new Date(2026, 10, 3, 8, 0)),
  });

  expect(await screen.findByText(/conteúdo de hoje ainda não chegou/i)).toBeOnTheScreen();
  expect(screen.getByText(/atualize o app/i)).toBeOnTheScreen();
});

test('suggests_updating_the_app_when_nothing_is_cached', async () => {
  await setup({ api: contentApiFailing(new UnsupportedContentVersionError(2)) });

  expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen();
  expect(screen.getByText(/atualize o app/i)).toBeOnTheScreen();
});

test('stale_content_without_new_version_does_not_suggest_updating', async () => {
  await setup({ clock: fixedClock(new Date(2026, 10, 3, 8, 0)) });

  await screen.findByText(/conteúdo de hoje ainda não chegou/i);
  expect(screen.queryByText(/atualize o app/i)).toBeNull();
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

test('saving_from_the_feed_persists_and_updates_the_panel', async () => {
  const { saved } = await setup();
  await screen.findByTestId('feed-list');
  const [firstPreview] = screen.getAllByRole('button', { name: /^Ler mais:/ });

  await fireEvent.press(firstPreview);
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar card' }));

  expect(await screen.findByRole('button', { name: 'Remover dos salvos' })).toBeOnTheScreen();
  expect(await saved.list()).toHaveLength(1);
});

test('completing_the_day_prepares_the_quiz', async () => {
  const { onFinished, quiz } = await setup();

  await fireEvent.press(await screen.findByRole('button', { name: 'Concluir o dia' }));

  await waitFor(() => expect(onFinished).toHaveBeenCalled());
  const prepared = await quiz.today();
  expect(prepared?.questions).toHaveLength(3);
  expect(new Set(prepared?.questions.map((card) => card.areaId)).size).toBe(3);
});

test('shows_stories_only_for_selected_areas', async () => {
  await setup({ preferences: { areaIds: ['economy', 'health'], subareaIds: [] } });

  await screen.findByTestId('feed-list');
  expect(screen.getByRole('button', { name: 'Story: Economia' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Story: Saúde' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /Story: Tecnologia/ })).toBeNull();
});

test('refreshes_reminders_when_opening_the_feed', async () => {
  const { reminders } = await setup();

  await screen.findByTestId('feed-list');

  expect(reminders.refresh).toHaveBeenCalledTimes(1);
});

test('completing_the_day_refreshes_reminders_after_recording_progress', async () => {
  const { onFinished, progress, reminders } = await setup();
  await screen.findByTestId('feed-list');
  let completedWhenRefreshed: string[] = [];
  reminders.refresh.mockImplementation(async () => {
    completedWhenRefreshed = (await progress.load()).completedDays;
  });

  await fireEvent.press(await screen.findByRole('button', { name: 'Concluir o dia' }));

  await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  expect(completedWhenRefreshed).toEqual(['2026-11-01']);
});

test('reminder_failures_do_not_block_completing_the_day', async () => {
  const { onFinished } = await setup({
    reminderRefresh: async () => {
      throw new Error('notifications unavailable');
    },
  });

  await fireEvent.press(await screen.findByRole('button', { name: 'Concluir o dia' }));

  await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
});

test('redirects_when_no_chosen_area_remains', async () => {
  const { onNeedOnboarding } = await setup({ preferences: { areaIds: ['arts'], subareaIds: [] } });

  await waitFor(() => expect(onNeedOnboarding).toHaveBeenCalledTimes(1));
});

test('ignores_chosen_area_missing_from_catalog', async () => {
  await setup({ preferences: { areaIds: ['arts', 'economy'], subareaIds: [] } });

  await screen.findByTestId('feed-list');
  const areas = SAMPLE.cards.filter((card) => card.areaId === 'economy').length;
  expect(screen.getByText(new RegExp(`de ${areas} vistos$`))).toBeOnTheScreen();
});

test('uses_published_quiz_question_count', async () => {
  const content = { ...SAMPLE, settings: { ...SAMPLE.settings, quizQuestions: 2 } };
  const { onFinished, quiz } = await setup({ api: contentApiReturning(content) });

  await fireEvent.press(await screen.findByRole('button', { name: 'Concluir o dia' }));

  await waitFor(() => expect(onFinished).toHaveBeenCalled());
  expect((await quiz.today())?.questions).toHaveLength(2);
});
