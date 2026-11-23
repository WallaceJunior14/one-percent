import { z } from 'zod';

import type { Card } from '@/features/content/contract';
import { type Clock, toLocalDateString } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
import { createVersionedStore, sameFormat } from '@/shared/lib/versionedStore';

export const PROGRESS_KEY = 'progress';

const daySummarySchema = z.object({
  date: z.string(),
  cardsRead: z.int().min(0),
  papersRead: z.int().min(0),
  areaIds: z.array(z.string()),
});

const progressSchema = z.object({
  completedDays: z.array(z.string()),
  totals: z.object({
    cards: z.int().min(0),
    papers: z.int().min(0),
    byArea: z.record(z.string(), z.int().min(0)),
  }),
  lastDay: daySummarySchema.nullable(),
});

/** Resumo de um dia concluído, mostrado na tela "Dia concluído". */
export type DaySummary = z.infer<typeof daySummarySchema>;
export type Progress = z.infer<typeof progressSchema>;

const EMPTY: Progress = {
  completedDays: [],
  totals: { cards: 0, papers: 0, byArea: {} },
  lastDay: null,
};

export type ProgressRepository = {
  load(): Promise<Progress>;
  /** Registra o dia de hoje como concluído. Repetir no mesmo dia não conta nada de novo. */
  completeDay(cards: readonly Card[]): Promise<DaySummary>;
};

export function createProgressRepository(store: KeyValueStore, clock: Clock): ProgressRepository {
  const stored = createVersionedStore({
    store,
    clock,
    key: PROGRESS_KEY,
    version: 2,
    schema: progressSchema,
    migrations: { 1: sameFormat },
    legacyKeys: ['progress.v1'],
  });
  const load = async (): Promise<Progress> => (await stored.read()) ?? EMPTY;

  return {
    load,
    async completeDay(cards) {
      const today = toLocalDateString(clock.now());
      const progress = await load();
      if (progress.lastDay?.date === today) return progress.lastDay;

      const summary: DaySummary = {
        date: today,
        cardsRead: cards.length,
        papersRead: cards.filter((card) => card.type === 'paper').length,
        areaIds: [...new Set(cards.map((card) => card.areaId))],
      };
      const byArea = { ...progress.totals.byArea };
      for (const card of cards) byArea[card.areaId] = (byArea[card.areaId] ?? 0) + 1;

      const updated: Progress = {
        completedDays: [...progress.completedDays, today].sort(),
        totals: {
          cards: progress.totals.cards + summary.cardsRead,
          papers: progress.totals.papers + summary.papersRead,
          byArea,
        },
        lastDay: summary,
      };
      await stored.write(updated);
      return summary;
    },
  };
}
