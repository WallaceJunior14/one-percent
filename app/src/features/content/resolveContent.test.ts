import sampleDay from '../../../../contracts/examples/sample-day.json';
import {
  contentApiFailing,
  contentApiReturning,
  createMemoryStore,
  fixedClock,
} from '@/test/fakes';
import { ContentUnavailableError } from './contentApi';
import { type DailyContent, parseDailyContent } from './contract';
import { CONTENT_CACHE_KEY, resolveContent } from './resolveContent';

const TODAY = new Date(2026, 10, 14, 9, 0);
const clock = fixedClock(TODAY);
const offline = () => contentApiFailing(new ContentUnavailableError('sem rede'));

function dayOf(date: string): DailyContent {
  return { ...parseDailyContent(sampleDay), date };
}

function cacheWith(content: DailyContent | string) {
  const value = typeof content === 'string' ? content : JSON.stringify(content);
  return createMemoryStore({ [CONTENT_CACHE_KEY]: value });
}

test('uses_today_from_network', async () => {
  const cache = createMemoryStore();

  const state = await resolveContent({
    api: contentApiReturning(dayOf('2026-11-14')),
    cache,
    clock,
  });

  expect(state).toMatchObject({ status: 'today', content: { date: '2026-11-14' } });
  expect(JSON.parse((await cache.getItem(CONTENT_CACHE_KEY)) ?? '{}').date).toBe('2026-11-14');
});

test('uses_cached_today_without_network', async () => {
  const api = contentApiReturning(dayOf('2026-11-14'));

  const state = await resolveContent({ api, cache: cacheWith(dayOf('2026-11-14')), clock });

  expect(state.status).toBe('today');
  expect(api.calls).toBe(0);
});

test('falls_back_to_cache_offline', async () => {
  const state = await resolveContent({
    api: offline(),
    cache: cacheWith(dayOf('2026-11-13')),
    clock,
  });

  expect(state).toMatchObject({ status: 'stale', content: { date: '2026-11-13' } });
});

test('shows_previous_day_with_warning', async () => {
  const cache = createMemoryStore();

  const state = await resolveContent({
    api: contentApiReturning(dayOf('2026-11-13')),
    cache,
    clock,
  });

  expect(state).toMatchObject({ status: 'stale', content: { date: '2026-11-13' } });
  expect(await cache.getItem(CONTENT_CACHE_KEY)).not.toBeNull();
});

test('empty_state_when_nothing_available', async () => {
  const state = await resolveContent({ api: offline(), cache: createMemoryStore(), clock });

  expect(state).toEqual({ status: 'empty' });
});

test('ignores_corrupted_cache', async () => {
  const api = contentApiReturning(dayOf('2026-11-14'));

  const state = await resolveContent({ api, cache: cacheWith('{not json'), clock });

  expect(state.status).toBe('today');
  expect(api.calls).toBe(1);
});

test('keeps_newest_when_network_returns_older_day', async () => {
  const cache = cacheWith(dayOf('2026-11-13'));

  const state = await resolveContent({
    api: contentApiReturning(dayOf('2026-11-12')),
    cache,
    clock,
  });

  expect(state).toMatchObject({ status: 'stale', content: { date: '2026-11-13' } });
  expect(JSON.parse((await cache.getItem(CONTENT_CACHE_KEY)) ?? '{}').date).toBe('2026-11-13');
});

test('invalid_payload_from_network_falls_back_to_cache', async () => {
  const api = contentApiFailing(new Error('ContractViolationError'));

  const state = await resolveContent({ api, cache: cacheWith(dayOf('2026-11-13')), clock });

  expect(state).toMatchObject({ status: 'stale', content: { date: '2026-11-13' } });
});
