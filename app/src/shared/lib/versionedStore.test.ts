import { z } from 'zod';

import { createMemoryStore, fixedClock } from '@/test/fakes';
import { createVersionedStore, type Migration, type UnreadableData } from './versionedStore';

const NOW = new Date(Date.UTC(2026, 10, 22, 12, 0, 0));
const UNREADABLE_KEY = `thing.unreadable.${NOW.getTime()}`;

const thingSchema = z.object({ count: z.int().min(0) });
type Thing = z.infer<typeof thingSchema>;

function setup({
  initial = {},
  version = 2,
  migrations = { 1: (data: unknown) => data },
}: {
  initial?: Record<string, string>;
  version?: number;
  migrations?: Record<number, Migration>;
} = {}) {
  const store = createMemoryStore(initial);
  const onUnreadable = jest.fn<void, [UnreadableData]>();
  const things = createVersionedStore<Thing>({
    store,
    key: 'thing',
    version,
    schema: thingSchema,
    migrations,
    legacyKeys: ['thing.v1'],
    clock: fixedClock(NOW),
    onUnreadable,
  });
  const raw = async (key: string) => {
    const value = await store.getItem(key);
    return value === null ? null : JSON.parse(value);
  };
  return { store, things, onUnreadable, raw };
}

test('returns_null_when_nothing_is_stored', async () => {
  const { things, onUnreadable } = setup();

  expect(await things.read()).toBeNull();
  expect(onUnreadable).not.toHaveBeenCalled();
});

test('writes_current_version', async () => {
  const { things, raw } = setup();

  await things.write({ count: 3 });

  expect(await raw('thing')).toEqual({ version: 2, data: { count: 3 } });
  expect(await things.read()).toEqual({ count: 3 });
});

describe('migrates_legacy_unversioned_value', () => {
  test('from a legacy key', async () => {
    const { things, raw, store } = setup({ initial: { 'thing.v1': '{"count": 5}' } });

    expect(await things.read()).toEqual({ count: 5 });

    expect(await raw('thing')).toEqual({ version: 2, data: { count: 5 } });
    expect(await store.getItem('thing.backup.v1')).toBe('{"count": 5}');
    expect(await store.getItem('thing.v1')).toBeNull();
  });

  test('from the current key', async () => {
    const { things, raw, store } = setup({ initial: { thing: '{"count": 5}' } });

    expect(await things.read()).toEqual({ count: 5 });

    expect(await raw('thing')).toEqual({ version: 2, data: { count: 5 } });
    expect(await store.getItem('thing.backup.v1')).toBe('{"count": 5}');
  });

  test('current key wins over a legacy key', async () => {
    const { things } = setup({
      initial: {
        thing: JSON.stringify({ version: 2, data: { count: 1 } }),
        'thing.v1': '{"count": 9}',
      },
    });

    expect(await things.read()).toEqual({ count: 1 });
  });
});

test('applies_migrations_in_order', async () => {
  const { things, raw, store } = setup({
    version: 3,
    migrations: {
      1: (data) => ({ total: (data as { n: number }).n }),
      2: (data) => ({ count: (data as { total: number }).total * 10 }),
    },
    initial: { 'thing.v1': '{"n": 2}' },
  });

  expect(await things.read()).toEqual({ count: 20 });
  expect(await raw('thing')).toEqual({ version: 3, data: { count: 20 } });
  expect(await store.getItem('thing.backup.v1')).toBe('{"n": 2}');
});

test('upgrades_an_older_envelope_keeping_a_backup', async () => {
  const older = JSON.stringify({ version: 2, data: { total: 4 } });
  const { things, raw, store } = setup({
    version: 3,
    migrations: {
      1: (data) => data,
      2: (data) => ({ count: (data as { total: number }).total }),
    },
    initial: { thing: older },
  });

  expect(await things.read()).toEqual({ count: 4 });
  expect(await raw('thing')).toEqual({ version: 3, data: { count: 4 } });
  expect(await store.getItem('thing.backup.v2')).toBe(older);
});

describe('preserves_unreadable_value', () => {
  const identity = { 1: (data: unknown) => data };
  test.each<[string, Record<string, string>, Record<number, Migration>]>([
    ['invalid json', { thing: '{not json' }, identity],
    ['fails the schema', { thing: JSON.stringify({ version: 2, data: { count: -1 } }) }, identity],
    ['newer version than the app', { thing: JSON.stringify({ version: 9, data: {} }) }, identity],
    ['no migration for the stored version', { thing: '{"count": 1}' }, {}],
  ])('%s', async (_name, initial, migrations) => {
    const { things, store, onUnreadable } = setup({ initial, migrations });

    expect(await things.read()).toBeNull();

    expect(await store.getItem(UNREADABLE_KEY)).toBe(initial.thing);
    expect(await store.getItem('thing')).toBeNull();
    expect(onUnreadable).toHaveBeenCalledWith({
      key: 'thing',
      copiedTo: UNREADABLE_KEY,
      reason: expect.any(String),
    });
  });

  test('unreadable legacy value is preserved too', async () => {
    const { things, store } = setup({ initial: { 'thing.v1': '[1, 2' } });

    expect(await things.read()).toBeNull();

    expect(await store.getItem(UNREADABLE_KEY)).toBe('[1, 2');
    expect(await store.getItem('thing.v1')).toBeNull();
  });

  test('is copied only once', async () => {
    const { things, onUnreadable } = setup({ initial: { thing: '{not json' } });

    await things.read();
    await things.read();

    expect(onUnreadable).toHaveBeenCalledTimes(1);
  });

  test('writing afterwards keeps the copy', async () => {
    const { things, store } = setup({ initial: { thing: '{not json' } });

    await things.read();
    await things.write({ count: 1 });

    expect(await store.getItem(UNREADABLE_KEY)).toBe('{not json');
    expect(await things.read()).toEqual({ count: 1 });
  });
});
