import { AREA_CATALOG } from '@/shared/config/areas';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';

export const PREFERENCES_KEY = 'preferences.v1';

export type Preferences = {
  areaIds: string[];
  /** Subáreas escolhidas; uma área sem subárea listada recebe todas (H3-1). */
  subareaIds: string[];
};

export class InvalidPreferencesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPreferencesError';
  }
}

const KNOWN_AREAS = new Set(AREA_CATALOG.map((area) => area.id));

/** Normaliza (sem duplicatas, sem subáreas órfãs) e valida as escolhas do usuário. */
export function validatePreferences(input: Preferences): Preferences {
  const areaIds = [...new Set(input.areaIds)];
  if (areaIds.length === 0) {
    throw new InvalidPreferencesError('escolha pelo menos uma área');
  }
  const unknown = areaIds.filter((id) => !KNOWN_AREAS.has(id));
  if (unknown.length > 0) {
    throw new InvalidPreferencesError(`áreas desconhecidas: ${unknown.join(', ')}`);
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

export function createPreferencesRepository(store: KeyValueStore): PreferencesRepository {
  return {
    async load() {
      const raw = await store.getItem(PREFERENCES_KEY);
      if (raw === null) return null;
      try {
        const parsed = JSON.parse(raw) as Preferences;
        return validatePreferences({
          areaIds: Array.isArray(parsed.areaIds) ? parsed.areaIds : [],
          subareaIds: Array.isArray(parsed.subareaIds) ? parsed.subareaIds : [],
        });
      } catch {
        return null;
      }
    },
    async save(preferences) {
      await store.setItem(PREFERENCES_KEY, JSON.stringify(validatePreferences(preferences)));
    },
  };
}
