import sampleDay from '../../../../contracts/examples/sample-day.json';
import {
  contentApiFailing,
  contentApiReturning,
  createMemoryStore,
  fixedClock,
  readJson,
} from '@/test/fakes';
import { ContentUnavailableError } from './contentApi';
import { type DailyContent, parseDailyContent, UnsupportedContentVersionError } from './contract';
import {
  CONTENT_CACHE_KEY,
  contentForCatalog,
  readCachedContent,
  resolveContent,
} from './resolveContent';

const NOW = new Date(Date.UTC(2026, 10, 14, 12, 0));
const clock = fixedClock(NOW);
const offline = () => contentApiFailing(new ContentUnavailableError('sem rede'));
const HOUR = 60 * 60 * 1000;

/** Conteúdo publicado há `hoursAgo` horas (intervalo padrão 24 h, tolerância 6 h). */
function published(hoursAgo: number, overrides: Partial<DailyContent> = {}): DailyContent {
  const at = new Date(NOW.getTime() - hoursAgo * HOUR);
  return {
    ...parseDailyContent(sampleDay),
    date: at.toISOString().slice(0, 10),
    generatedAt: at.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    ...overrides,
  };
}

async function cachedGeneratedAt(cache: ReturnType<typeof createMemoryStore>) {
  const stored = (await readJson(cache, CONTENT_CACHE_KEY)) as {
    data?: { generatedAt?: string };
  } | null;
  return stored?.data?.generatedAt;
}

function cacheWith(content: DailyContent | string) {
  const value = typeof content === 'string' ? content : JSON.stringify(content);
  return createMemoryStore({ [CONTENT_CACHE_KEY]: value });
}

test('uses_cache_before_interval', async () => {
  const api = contentApiReturning(published(1));

  const state = await resolveContent({ api, cache: cacheWith(published(2)), clock });

  expect(state.status).toBe('today');
  expect(api.calls).toBe(0);
});

test('fetches_after_interval', async () => {
  const cache = cacheWith(published(25));
  const newer = published(1);

  const state = await resolveContent({ api: contentApiReturning(newer), cache, clock });

  expect(state).toMatchObject({ status: 'today', content: { generatedAt: newer.generatedAt } });
  expect(await cachedGeneratedAt(cache)).toBe(newer.generatedAt);
});

test('no_warning_within_tolerance_even_offline', async () => {
  const state = await resolveContent({ api: offline(), cache: cacheWith(published(29)), clock });

  expect(state.status).toBe('today');
});

test('warns_only_after_tolerance', async () => {
  const state = await resolveContent({ api: offline(), cache: cacheWith(published(31)), clock });

  expect(state.status).toBe('stale');
});

test('uses_publication_time_not_calendar_date', async () => {
  const tomorrowLabel = published(2, { date: '2026-11-15' });
  const todayLabelButOld = published(40, { date: '2026-11-14' });

  const fresh = await resolveContent({ api: offline(), cache: cacheWith(tomorrowLabel), clock });
  const old = await resolveContent({ api: offline(), cache: cacheWith(todayLabelButOld), clock });

  expect(fresh.status).toBe('today');
  expect(old.status).toBe('stale');
});

test('uses_the_interval_published_in_the_content', async () => {
  const api = contentApiReturning(published(1));
  const cached = published(13, { settings: { publishIntervalHours: 12 } });

  await resolveContent({ api, cache: cacheWith(cached), clock });

  expect(api.calls).toBe(1);
});

test('uses_today_from_network', async () => {
  const cache = createMemoryStore();
  const fresh = published(1);

  const state = await resolveContent({ api: contentApiReturning(fresh), cache, clock });

  expect(state.status).toBe('today');
  expect(await cachedGeneratedAt(cache)).toBe(fresh.generatedAt);
});

test('shows_previous_day_with_warning', async () => {
  const cache = createMemoryStore();

  const state = await resolveContent({ api: contentApiReturning(published(40)), cache, clock });

  expect(state.status).toBe('stale');
  expect(await cache.getItem(CONTENT_CACHE_KEY)).not.toBeNull();
});

test('empty_state_when_nothing_available', async () => {
  const state = await resolveContent({ api: offline(), cache: createMemoryStore(), clock });

  expect(state).toEqual({ status: 'empty' });
});

test('ignores_corrupted_cache', async () => {
  const api = contentApiReturning(published(1));

  const state = await resolveContent({ api, cache: cacheWith('{not json'), clock });

  expect(state.status).toBe('today');
  expect(api.calls).toBe(1);
});

test('keeps_newest_when_network_returns_older_content', async () => {
  const cached = published(31);
  const cache = cacheWith(cached);

  const state = await resolveContent({ api: contentApiReturning(published(50)), cache, clock });

  expect(state).toMatchObject({ status: 'stale', content: { generatedAt: cached.generatedAt } });
  expect(await cachedGeneratedAt(cache)).toBe(cached.generatedAt);
});

test('invalid_payload_from_network_falls_back_to_cache', async () => {
  const api = contentApiFailing(new Error('ContractViolationError'));

  const state = await resolveContent({ api, cache: cacheWith(published(31)), clock });

  expect(state.status).toBe('stale');
});

describe('newer_major_version', () => {
  const newerVersion = () => contentApiFailing(new UnsupportedContentVersionError(2));

  test('keeps_cache_when_major_version_is_newer', async () => {
    const cached = published(31);
    const cache = cacheWith(cached);

    const state = await resolveContent({ api: newerVersion(), cache, clock });

    expect(state).toMatchObject({
      status: 'stale',
      content: { generatedAt: cached.generatedAt },
      updateSuggested: true,
    });
  });

  test('suggests_update_even_without_cache', async () => {
    const state = await resolveContent({ api: newerVersion(), cache: createMemoryStore(), clock });

    expect(state).toEqual({ status: 'empty', updateSuggested: true });
  });

  test('other_failures_do_not_suggest_update', async () => {
    const state = await resolveContent({ api: offline(), cache: cacheWith(published(31)), clock });

    expect(state).not.toHaveProperty('updateSuggested');
  });
});

test('reads_cache_written_by_the_previous_version', async () => {
  const cache = cacheWith(published(2));
  const api = contentApiReturning(published(1));

  const state = await resolveContent({ api, cache, clock });

  expect(state.status).toBe('today');
  expect(api.calls).toBe(0);
  expect(await readJson(cache, CONTENT_CACHE_KEY)).toMatchObject({ version: 2 });
});

test('reads_cached_content_without_network', async () => {
  const cached = published(2);

  expect(await readCachedContent(cacheWith(cached), clock)).toMatchObject({
    generatedAt: cached.generatedAt,
  });
  expect(await readCachedContent(createMemoryStore(), clock)).toBeNull();
});

describe('published values cannot freeze the cache', () => {
  test('interval_above_the_ceiling_is_ignored', async () => {
    const api = contentApiReturning(published(1));
    const cached = published(25, { settings: { publishIntervalHours: 240 } });

    await resolveContent({ api, cache: cacheWith(cached), clock });

    expect(api.calls).toBe(1);
  });

  test.each([
    ['in the future', '2026-11-20T12:00:00Z'],
    ['not a real date', '2026-13-45T99:99:99Z'],
  ])('cache published %s is replaced by fetched content', async (_name, generatedAt) => {
    const cache = cacheWith(published(1, { generatedAt }));
    const fresh = published(2);

    const state = await resolveContent({ api: contentApiReturning(fresh), cache, clock });

    expect(state).toMatchObject({ status: 'today', content: { generatedAt: fresh.generatedAt } });
    expect(await cachedGeneratedAt(cache)).toBe(fresh.generatedAt);
  });

  test.each([
    ['in the future', '2026-11-20T12:00:00Z'],
    ['not a real date', '2026-13-45T99:99:99Z'],
  ])('offline cache published %s counts as late', async (_name, generatedAt) => {
    const cache = cacheWith(published(1, { generatedAt }));

    const state = await resolveContent({ api: offline(), cache, clock });

    expect(state.status).toBe('stale');
  });

  test('small_clock_skew_does_not_count_as_late', async () => {
    const cache = cacheWith(published(-0.05)); // publicado 3 min "no futuro" pelo relógio do celular

    const state = await resolveContent({ api: offline(), cache, clock });

    expect(state.status).toBe('today');
  });
});

test('failing_cache_write_still_returns_the_fetched_content', async () => {
  const memory = createMemoryStore();
  const cache = {
    ...memory,
    setItem: async () => {
      throw new Error('quota exceeded');
    },
  };
  const fresh = published(1);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  const state = await resolveContent({ api: contentApiReturning(fresh), cache, clock });

  expect(state).toMatchObject({ status: 'today', content: { generatedAt: fresh.generatedAt } });
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

describe('dropped cards are reported', () => {
  test('fetched_content_reports_each_dropped_card', async () => {
    const onDroppedCards = jest.fn();
    const fetched = parseDailyContent({
      ...(structuredClone(sampleDay) as object),
      generatedAt: published(1).generatedAt,
      cards: [
        { ...sampleDay.cards[0], url: 'http://example.com/inseguro' },
        ...sampleDay.cards.slice(1),
      ],
    });

    await resolveContent({
      api: contentApiReturning(fetched),
      cache: createMemoryStore(),
      clock,
      onDroppedCards,
    });

    expect(onDroppedCards).toHaveBeenCalledTimes(1);
    expect(onDroppedCards).toHaveBeenCalledWith([
      { index: 0, id: sampleDay.cards[0].id, reason: expect.stringContaining('url') },
    ]);
  });

  test('stays_silent_when_nothing_was_dropped', async () => {
    const onDroppedCards = jest.fn();

    await resolveContent({
      api: contentApiReturning(published(1)),
      cache: createMemoryStore(),
      clock,
      onDroppedCards,
    });

    expect(onDroppedCards).not.toHaveBeenCalled();
  });
});

describe('content_for_the_onboarding_catalog', () => {
  const withExtraArea = (): DailyContent => {
    const content = published(1);
    return {
      ...content,
      areas: [
        ...content.areas,
        { id: 'climate', name: 'Clima', subareas: [{ id: 'climate.air', name: 'Ar' }] },
      ],
    };
  };

  test('first_access_with_internet_downloads_and_caches_the_content', async () => {
    const cache = createMemoryStore();
    const fetched = withExtraArea();

    const content = await contentForCatalog({ api: contentApiReturning(fetched), cache, clock });

    expect(content?.areas.map((area) => area.id)).toContain('climate');
    expect(await cachedGeneratedAt(cache)).toBe(fetched.generatedAt);
  });

  test('uses_the_cache_without_going_to_the_network', async () => {
    const api = contentApiReturning(withExtraArea());

    const content = await contentForCatalog({ api, cache: cacheWith(published(40)), clock });

    expect(content?.generatedAt).toBe(published(40).generatedAt);
    expect(api.calls).toBe(0);
  });

  test('first_access_offline_returns_null', async () => {
    const content = await contentForCatalog({ api: offline(), cache: createMemoryStore(), clock });

    expect(content).toBeNull();
  });

  test('gives_up_when_the_network_is_too_slow', async () => {
    const hanging = { calls: 0, fetchLatest: () => new Promise<DailyContent>(() => undefined) };

    const content = await contentForCatalog(
      { api: hanging, cache: createMemoryStore(), clock },
      10,
    );

    expect(content).toBeNull();
  });
});
