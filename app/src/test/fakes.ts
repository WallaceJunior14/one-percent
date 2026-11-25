import type { DailyContent } from '@/features/content/contract';
import type { ContentApi } from '@/features/content/contentApi';
import type { Clock } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';

export function createMemoryStore(
  initial: Record<string, string> = {},
): KeyValueStore & { keys(): string[] } {
  const data = new Map(Object.entries(initial));
  return {
    keys: () => [...data.keys()],
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
    getAllKeys: async () => [...data.keys()],
  };
}

export function fixedClock(date: Date): Clock {
  return { now: () => date };
}

export function contentApiReturning(content: DailyContent): ContentApi & { calls: number } {
  const api = {
    calls: 0,
    fetchLatest: async () => {
      api.calls += 1;
      return content;
    },
  };
  return api;
}

export function contentApiFailing(error: Error): ContentApi & { calls: number } {
  const api = {
    calls: 0,
    fetchLatest: async (): Promise<DailyContent> => {
      api.calls += 1;
      throw error;
    },
  };
  return api;
}

/** Valor gravado numa chave, já decodificado do JSON. */
export async function readJson(store: KeyValueStore, key: string): Promise<unknown> {
  const raw = await store.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}
