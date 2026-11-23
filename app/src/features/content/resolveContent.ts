import { resolveFeedSettings } from '@/features/feed/feedSettings';
import type { Clock } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
import { createVersionedStore, sameFormat } from '@/shared/lib/versionedStore';
import type { ContentApi } from './contentApi';
import { type DailyContent, parseDailyContent, UnsupportedContentVersionError } from './contract';

export const CONTENT_CACHE_KEY = 'content.latest';

/**
 * - `today`: conteúdo atual (publicado dentro do intervalo esperado mais a tolerância).
 * - `stale`: o mais recente disponível, mas atrasado; a tela mostra um aviso.
 * - `empty`: nada disponível (primeiro acesso sem internet); a tela oferece tentar de novo.
 *
 * `updateSuggested`: o servidor publicou uma versão do contrato que este app não lê.
 */
export type ContentState = (
  | { status: 'today'; content: DailyContent }
  | { status: 'stale'; content: DailyContent }
  | { status: 'empty' }
) & { updateSuggested?: true };

type Dependencies = { api: ContentApi; cache: KeyValueStore; clock: Clock };

function contentCache(cache: KeyValueStore, clock: Clock) {
  return createVersionedStore<DailyContent>({
    store: cache,
    clock,
    key: CONTENT_CACHE_KEY,
    version: 2,
    schema: { parse: parseDailyContent },
    migrations: { 1: sameFormat },
  });
}

type FetchResult = { content: DailyContent | null; updateSuggested?: true };

async function fetchLatest(api: ContentApi): Promise<FetchResult> {
  try {
    return { content: await api.fetchLatest() };
  } catch (error) {
    if (error instanceof UnsupportedContentVersionError) {
      return { content: null, updateSuggested: true };
    }
    return { content: null }; // sem rede, erro do servidor ou payload inválido: usamos o cache
  }
}

const HOUR_MS = 60 * 60 * 1000;

function hoursSincePublished(content: DailyContent, now: Date): number {
  return (now.getTime() - Date.parse(content.generatedAt)) / HOUR_MS;
}

function newest(a: DailyContent | null, b: DailyContent | null): DailyContent | null {
  if (a === null) return b;
  if (b === null) return a;
  return Date.parse(b.generatedAt) > Date.parse(a.generatedAt) ? b : a;
}

/** Último conteúdo guardado, sem ir à rede (ex.: catálogo para o onboarding). */
export function readCachedContent(
  cache: KeyValueStore,
  clock: Clock,
): Promise<DailyContent | null> {
  return contentCache(cache, clock).read();
}

/**
 * Decide o que mostrar pelo momento de publicação, e não pela data no fuso do celular:
 * antes do intervalo esperado usa o cache; depois, busca o novo; passado o intervalo mais a
 * tolerância, mostra o aviso de conteúdo atrasado.
 */
export async function resolveContent({ api, cache, clock }: Dependencies): Promise<ContentState> {
  const now = clock.now();
  const stored = contentCache(cache, clock);
  const cached = await stored.read();
  if (cached) {
    const { publishIntervalHours } = resolveFeedSettings(cached.settings);
    if (hoursSincePublished(cached, now) < publishIntervalHours) {
      return { status: 'today', content: cached };
    }
  }

  const { content: fetched, updateSuggested } = await fetchLatest(api);
  const suggestion = updateSuggested ? { updateSuggested } : {};
  const best = newest(cached, fetched);
  if (best === null) return { status: 'empty', ...suggestion };

  if (best !== cached) await stored.write(best);
  const { publishIntervalHours, freshnessToleranceHours } = resolveFeedSettings(best.settings);
  const late = hoursSincePublished(best, now) > publishIntervalHours + freshnessToleranceHours;
  return { status: late ? 'stale' : 'today', content: best, ...suggestion };
}
