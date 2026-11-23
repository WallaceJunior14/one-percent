import { z } from 'zod';

import { type Card, cardSchema } from '@/features/content/contract';
import type { Clock } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';

export const SAVED_KEY = 'saved.v1';

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
  const list = async (): Promise<SavedCard[]> => {
    const raw = await store.getItem(SAVED_KEY);
    if (raw === null) return [];
    try {
      return savedListSchema.parse(JSON.parse(raw));
    } catch {
      return [];
    }
  };

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
      await store.setItem(SAVED_KEY, JSON.stringify(next));
      return !isSaved;
    },
  };
}
