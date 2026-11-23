import { z } from 'zod';

import { type Clock, toLocalDateString } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';

export const SEEN_STORIES_KEY = 'stories.seen.v1';

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
  const seenToday = async (): Promise<Set<string>> => {
    const raw = await store.getItem(SEEN_STORIES_KEY);
    if (raw === null) return new Set();
    try {
      const stored = storedSchema.parse(JSON.parse(raw));
      return stored.date === toLocalDateString(clock.now()) ? new Set(stored.areaIds) : new Set();
    } catch {
      return new Set();
    }
  };

  return {
    seenToday,
    async markSeen(areaId) {
      const seen = await seenToday();
      seen.add(areaId);
      await store.setItem(
        SEEN_STORIES_KEY,
        JSON.stringify({ date: toLocalDateString(clock.now()), areaIds: [...seen] }),
      );
    },
  };
}
