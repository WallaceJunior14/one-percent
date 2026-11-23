import { z } from 'zod';

import { type Clock, systemClock } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
import { createVersionedStore, sameFormat } from '@/shared/lib/versionedStore';

export const PREFERENCES_KEY = 'preferences';

export type Preferences = {
  areaIds: string[];
  /** Subáreas escolhidas; uma área sem subárea listada recebe todas. */
  subareaIds: string[];
};

export class InvalidPreferencesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPreferencesError';
  }
}

/**
 * Normaliza as escolhas (sem duplicatas, sem subáreas órfãs). Áreas que o catálogo atual não
 * tem são filtradas por quem monta o feed, porque o catálogo muda com o conteúdo publicado.
 */
export function validatePreferences(input: Preferences): Preferences {
  const areaIds = [...new Set(input.areaIds)];
  if (areaIds.length === 0) {
    throw new InvalidPreferencesError('escolha pelo menos uma área');
  }
  const subareaIds = [...new Set(input.subareaIds)].filter((id) =>
    areaIds.includes(id.split('.')[0]),
  );
  return { areaIds, subareaIds };
}

export type PreferencesRepository = {
  /** `null` quando o usuário ainda não fez o onboarding (ou os dados estão corrompidos). */
  load(): Promise<Preferences | null>;
  save(preferences: Preferences): Promise<void>;
};

const storedSchema = z.object({
  areaIds: z.array(z.string()).catch([]),
  subareaIds: z.array(z.string()).catch([]),
});

export function createPreferencesRepository(
  store: KeyValueStore,
  clock: Clock = systemClock,
): PreferencesRepository {
  const stored = createVersionedStore({
    store,
    clock,
    key: PREFERENCES_KEY,
    version: 2,
    schema: storedSchema,
    migrations: { 1: sameFormat },
    legacyKeys: ['preferences.v1'],
  });
  return {
    async load() {
      const preferences = await stored.read();
      if (preferences === null) return null;
      try {
        return validatePreferences(preferences);
      } catch {
        return null; // lido, mas sem escolha válida: o usuário refaz o onboarding
      }
    },
    async save(preferences) {
      await stored.write(validatePreferences(preferences));
    },
  };
}
