import { z } from 'zod';

import { type Card, cardSchema } from '@/features/content/contract';
import type { Clock } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
import { createVersionedStore, sameFormat } from '@/shared/lib/versionedStore';

export const SAVED_KEY = 'saved';

const savedCardSchema = z.object({ card: cardSchema, savedAt: z.string() });

// O card entra sem validação: se o leitor do contrato ficar mais estrito, um card salvo antigo
// que deixe de passar some da lista, mas continua guardado, sem arrastar a lista inteira.
const storedItemSchema = z.object({ card: z.unknown(), savedAt: z.string() });
const storedListSchema = z.array(storedItemSchema);

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
    schema: storedListSchema,
    migrations: { 1: sameFormat },
    legacyKeys: ['saved.v1'],
  });
  const readStored = async () => (await stored.read()) ?? [];
  const list = async (): Promise<SavedCard[]> =>
    (await readStored()).flatMap((item) => {
      const parsed = savedCardSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  const idOf = (item: z.infer<typeof storedItemSchema>) =>
    (item.card as { id?: unknown } | null)?.id;

  return {
    list,
    async savedIds() {
      return new Set((await list()).map((saved) => saved.card.id));
    },
    async toggle(card) {
      const current = await readStored();
      const isSaved = current.some((item) => idOf(item) === card.id);
      const next = isSaved
        ? current.filter((item) => idOf(item) !== card.id)
        : [{ card, savedAt: clock.now().toISOString() }, ...current];
      await stored.write(next);
      return !isSaved;
    },
  };
}
