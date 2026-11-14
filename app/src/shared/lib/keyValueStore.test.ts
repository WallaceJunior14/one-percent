import AsyncStorage from '@react-native-async-storage/async-storage';

import { createMemoryStore } from '@/test/fakes';
import { asyncStorageStore } from './keyValueStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe.each([
  ['memory', () => createMemoryStore()],
  ['asyncStorage', () => asyncStorageStore],
])('%s store', (_name, makeStore) => {
  beforeEach(() => AsyncStorage.clear());

  test('returns_null_for_missing_key', async () => {
    expect(await makeStore().getItem('missing')).toBeNull();
  });

  test('stores_and_reads_values', async () => {
    const store = makeStore();
    await store.setItem('key', 'value');

    expect(await store.getItem('key')).toBe('value');
  });

  test('removes_values', async () => {
    const store = makeStore();
    await store.setItem('key', 'value');
    await store.removeItem('key');

    expect(await store.getItem('key')).toBeNull();
  });
});
