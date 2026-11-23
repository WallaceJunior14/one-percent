import Constants from 'expo-constants';

import { catalogFrom } from '@/features/content/catalog';
import { createHttpContentApi } from '@/features/content/contentApi';
import { readCachedContent } from '@/features/content/resolveContent';
import type { DailyFeedDependencies } from '@/features/feed/DailyFeed';
import { resolveFeedSettings } from '@/features/feed/feedSettings';
import { createPreferencesRepository } from '@/features/onboarding/preferences';
import { createQuizRepository } from '@/features/quiz/quizRepository';
import { createSavedCardsRepository } from '@/features/saved/savedCards';
import { createSeenStoriesRepository } from '@/features/stories/seenStories';
import { expoNotificationScheduler } from '@/features/reminders/expoNotificationScheduler';
import { createReminderService } from '@/features/reminders/reminderScheduler';
import { createProgressRepository } from '@/features/streak/progress';
import { contentBaseUrlFrom } from '@/shared/config/buildConfig';
import { systemClock } from '@/shared/lib/dates';
import { asyncStorageStore } from '@/shared/lib/keyValueStore';

export const CONTENT_BASE_URL = contentBaseUrlFrom(Constants.expoConfig?.extra);

const cachedContent = () => readCachedContent(asyncStorageStore, systemClock);

/** Catálogo do último conteúdo baixado (ou o embutido), para o onboarding. */
export const loadCatalog = async () => catalogFrom(await cachedContent());

/** Dependências reais do app; os testes usam as versões de `src/test/fakes`. */
export const preferencesRepository = createPreferencesRepository(asyncStorageStore);
export const progressRepository = createProgressRepository(asyncStorageStore, systemClock);
export const savedCardsRepository = createSavedCardsRepository(asyncStorageStore, systemClock);
export const quizRepository = createQuizRepository(asyncStorageStore, systemClock);
export const seenStoriesRepository = createSeenStoriesRepository(asyncStorageStore, systemClock);
export const reminderService = createReminderService({
  store: asyncStorageStore,
  scheduler: expoNotificationScheduler,
  progress: progressRepository,
  clock: systemClock,
  feedSettings: async () => resolveFeedSettings((await cachedContent())?.settings),
});

export const appDependencies: DailyFeedDependencies = {
  api: createHttpContentApi(CONTENT_BASE_URL),
  cache: asyncStorageStore,
  clock: systemClock,
  preferences: preferencesRepository,
  progress: progressRepository,
  saved: savedCardsRepository,
  quiz: quizRepository,
  seenStories: seenStoriesRepository,
  reminders: reminderService,
};
