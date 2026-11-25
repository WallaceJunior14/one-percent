import { resolveFeedSettings } from '@/features/feed/feedSettings';
import type { Clock } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
import { createVersionedStore, sameFormat } from '@/shared/lib/versionedStore';
import type { ContentApi } from './contentApi';
import {
  type DailyContent,
  type DroppedCard,
  parseDailyContent,
  UnsupportedContentVersionError,
} from './contract';

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

type Dependencies = {
  api: ContentApi;
  cache: KeyValueStore;
  clock: Clock;
  /** Chamado com os cards que o app descartou ao ler o conteúdo baixado. */
  onDroppedCards?(dropped: readonly DroppedCard[]): void;
};

// Fora dos testes, o aviso no console é o registro; nos testes, quem quiser observar passa
// `onDroppedCards`.
function warnDroppedCards(dropped: readonly DroppedCard[]) {
  if (process.env.NODE_ENV === 'test') return;
  console.warn(`${dropped.length} card(s) descartado(s) ao ler o conteúdo`, dropped);
}

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

async function fetchLatest(
  api: ContentApi,
  onDroppedCards: (dropped: readonly DroppedCard[]) => void,
): Promise<FetchResult> {
  try {
    const content = await api.fetchLatest();
    const dropped = content.diagnostics?.droppedCards ?? [];
    if (dropped.length > 0) onDroppedCards(dropped);
    return { content };
  } catch (error) {
    if (error instanceof UnsupportedContentVersionError) {
      return { content: null, updateSuggested: true };
    }
    return { content: null }; // sem rede, erro do servidor ou payload inválido: usamos o cache
  }
}

const HOUR_MS = 60 * 60 * 1000;
/** Folga para o relógio do celular estar um pouco atrasado em relação ao do servidor. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/** Momento de publicação, ou `null` se for inválido ou estiver no futuro: conta como atrasado. */
function publishedAt(content: DailyContent, now: Date): number | null {
  const time = Date.parse(content.generatedAt);
  return Number.isNaN(time) || time > now.getTime() + CLOCK_SKEW_MS ? null : time;
}

function hoursSincePublished(content: DailyContent, now: Date): number {
  const time = publishedAt(content, now);
  return time === null ? Infinity : Math.max(0, now.getTime() - time) / HOUR_MS;
}

function newest(a: DailyContent | null, b: DailyContent | null, now: Date): DailyContent | null {
  if (a === null) return b;
  if (b === null) return a;
  const timeA = publishedAt(a, now);
  const timeB = publishedAt(b, now);
  if (timeA === null) return b;
  return timeB !== null && timeB > timeA ? b : a;
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
export async function resolveContent({
  api,
  cache,
  clock,
  onDroppedCards = warnDroppedCards,
}: Dependencies): Promise<ContentState> {
  const now = clock.now();
  const stored = contentCache(cache, clock);
  const cached = await stored.read();
  if (cached) {
    const { publishIntervalHours } = resolveFeedSettings(cached.settings);
    if (hoursSincePublished(cached, now) < publishIntervalHours) {
      return { status: 'today', content: cached };
    }
  }

  const { content: fetched, updateSuggested } = await fetchLatest(api, onDroppedCards);
  const suggestion = updateSuggested ? { updateSuggested } : {};
  const best = newest(cached, fetched, now);
  if (best === null) return { status: 'empty', ...suggestion };

  if (best !== cached) {
    // Sem espaço para gravar, o conteúdo buscado ainda serve para esta abertura.
    await stored.write(best).catch((error: unknown) => console.warn('cache não gravado', error));
  }
  const { publishIntervalHours, freshnessToleranceHours } = resolveFeedSettings(best.settings);
  const late = hoursSincePublished(best, now) > publishIntervalHours + freshnessToleranceHours;
  return { status: late ? 'stale' : 'today', content: best, ...suggestion };
}

/**
 * Conteúdo de onde sai o catálogo do onboarding: o do cache e, se não houver (primeiro acesso),
 * o baixado agora, que fica no cache. Devolve `null` sem internet ou se a rede demorar mais que
 * `timeoutMs`; quem chama usa o catálogo embutido.
 */
export async function contentForCatalog(
  dependencies: Dependencies,
  timeoutMs = 5000,
): Promise<DailyContent | null> {
  const cached = await readCachedContent(dependencies.cache, dependencies.clock);
  if (cached) return cached;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ContentState>((resolve) => {
    timer = setTimeout(() => resolve({ status: 'empty' }), timeoutMs);
  });
  try {
    const state = await Promise.race([resolveContent(dependencies), timeout]);
    return state.status === 'empty' ? null : state.content;
  } finally {
    clearTimeout(timer);
  }
}
