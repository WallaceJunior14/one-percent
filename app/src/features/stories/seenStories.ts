import { z } from 'zod';

import { type Clock, toLocalDateString } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
import { createVersionedStore, sameFormat } from '@/shared/lib/versionedStore';

export const SEEN_STORIES_KEY = 'stories.seen';

const storedSchema = z.object({ date: z.string(), areaIds: z.array(z.string()) });

export type SeenStoriesRepository = {
  /** Áreas cujo story já foi visto hoje. Zera a cada dia. */
  seenToday(): Promise<Set<string>>;
  markSeen(areaId: string): Promise<void>;
};

export function createSeenStoriesRepository(
  store: KeyValueStore,
  clock: Clock,
): SeenStoriesRepository {
  const stored = createVersionedStore({
    store,
    clock,
    key: SEEN_STORIES_KEY,
    version: 2,
    schema: storedSchema,
    migrations: { 1: sameFormat },
    legacyKeys: ['stories.seen.v1'],
  });
  const seenToday = async (): Promise<Set<string>> => {
    const seen = await stored.read();
    return seen?.date === toLocalDateString(clock.now()) ? new Set(seen.areaIds) : new Set();
  };

  return {
    seenToday,
    async markSeen(areaId) {
      const seen = await seenToday();
      seen.add(areaId);
      await stored.write({ date: toLocalDateString(clock.now()), areaIds: [...seen] });
    },
  };
}
