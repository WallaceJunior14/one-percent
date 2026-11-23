import { type Clock, toLocalDateString } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
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

async function readCache(cache: KeyValueStore): Promise<DailyContent | null> {
  const raw = await cache.getItem(CONTENT_CACHE_KEY);
  if (raw === null) return null;
  try {
    return parseDailyContent(JSON.parse(raw));
  } catch {
    return null; // cache corrompido ou de um contrato antigo: tratado como ausente
  }
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
  const cached = await readCache(cache);
  if (cached?.date === today) return { status: 'today', content: cached };

  const { content: fetched, updateSuggested } = await fetchLatest(api);
  const suggestion = updateSuggested ? { updateSuggested } : {};
  const best = newest(cached, fetched);
  if (best === null) return { status: 'empty', ...suggestion };

  if (best !== cached) await cache.setItem(CONTENT_CACHE_KEY, JSON.stringify(best));
  return { status: best.date === today ? 'today' : 'stale', content: best, ...suggestion };
}
