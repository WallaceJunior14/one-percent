import { z } from 'zod';

import { type Card, cardSchema } from '@/features/content/contract';
import type { Clock } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
import { createVersionedStore, sameFormat } from '@/shared/lib/versionedStore';

export const SAVED_KEY = 'saved';

const savedCardSchema = z.object({ card: cardSchema, savedAt: z.string() });
const savedListSchema = z.array(savedCardSchema);

/** Card salvo por inteiro, para continuar disponível depois que o dia muda e sem internet. */
export type SavedCard = z.infer<typeof savedCardSchema>;

export type SavedCardsRepository = {
  /** Do mais recente para o mais antigo. */
  list(): Promise<SavedCard[]>;
  savedIds(): Promise<Set<string>>;
  /** Salva ou remove; devolve `true` se o card ficou salvo. */
  toggle(card: Card): Promise<boolean>;
};

export function createSavedCardsRepository(
  store: KeyValueStore,
  clock: Clock,
): SavedCardsRepository {
  const stored = createVersionedStore({
    store,
    clock,
    key: SAVED_KEY,
    version: 2,
    schema: savedListSchema,
    migrations: { 1: sameFormat },
    legacyKeys: ['saved.v1'],
  });
  const list = async (): Promise<SavedCard[]> => (await stored.read()) ?? [];

  return {
    list,
    async savedIds() {
      return new Set((await list()).map((saved) => saved.card.id));
    },
    async toggle(card) {
      const current = await list();
      const isSaved = current.some((saved) => saved.card.id === card.id);
      const next = isSaved
        ? current.filter((saved) => saved.card.id !== card.id)
        : [{ card, savedAt: clock.now().toISOString() }, ...current];
      await stored.write(next);
      return !isSaved;
    },
  };
}
