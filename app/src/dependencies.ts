import { createHttpContentApi } from '@/features/content/contentApi';
import type { DailyFeedDependencies } from '@/features/feed/DailyFeed';
import { createPreferencesRepository } from '@/features/onboarding/preferences';
import { createProgressRepository } from '@/features/streak/progress';
import { systemClock } from '@/shared/lib/dates';
import { asyncStorageStore } from '@/shared/lib/keyValueStore';

/** Conteúdo publicado pelo pipeline no GitHub Pages (T053). */
export const CONTENT_BASE_URL = 'https://wallacejunior14.github.io/one-percent/';

/** Dependências reais do app; os testes usam as versões de `src/test/fakes`. */
export const preferencesRepository = createPreferencesRepository(asyncStorageStore);
export const progressRepository = createProgressRepository(asyncStorageStore, systemClock);

export const appDependencies: DailyFeedDependencies = {
  api: createHttpContentApi(CONTENT_BASE_URL),
  cache: asyncStorageStore,
  clock: systemClock,
  preferences: preferencesRepository,
  progress: progressRepository,
};
