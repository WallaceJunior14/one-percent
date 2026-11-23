import { type Clock, toLocalDateString } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
import { createVersionedStore, sameFormat } from '@/shared/lib/versionedStore';
import type { ContentApi } from './contentApi';
import { type DailyContent, parseDailyContent, UnsupportedContentVersionError } from './contract';

export const CONTENT_CACHE_KEY = 'content.latest';

/**
 * - `today`: conteúdo do dia.
 * - `stale`: o mais recente disponível, de um dia anterior; a tela mostra um aviso.
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

function newest(a: DailyContent | null, b: DailyContent | null): DailyContent | null {
  if (a === null) return b;
  if (b === null) return a;
  return b.date > a.date ? b : a; // datas AAAA-MM-DD comparam corretamente como texto
}

/** Decide o que mostrar: hoje → cache de hoje → mais recente com aviso → vazio. */
export async function resolveContent({ api, cache, clock }: Dependencies): Promise<ContentState> {
  const today = toLocalDateString(clock.now());
  const stored = contentCache(cache, clock);
  const cached = await stored.read();
  if (cached?.date === today) return { status: 'today', content: cached };

  const { content: fetched, updateSuggested } = await fetchLatest(api);
  const suggestion = updateSuggested ? { updateSuggested } : {};
  const best = newest(cached, fetched);
  if (best === null) return { status: 'empty', ...suggestion };

  if (best !== cached) await stored.write(best);
  return { status: best.date === today ? 'today' : 'stale', content: best, ...suggestion };
}
