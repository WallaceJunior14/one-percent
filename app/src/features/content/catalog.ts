import { AREA_CATALOG, BUNDLED_GROUPS } from '@/shared/config/areas';
import type { Area, Group } from './contract';

export type CatalogArea = Area & { groupId: string; weight: number };
export type Catalog = { groups: Group[]; areas: CatalogArea[] };

const FALLBACK_GROUP: Group = { id: 'other', name: 'Outras áreas' };
const FALLBACK_WEIGHT = 1;

const bundledById = new Map(AREA_CATALOG.map((area) => [area.id, area]));

function complete(area: Area): CatalogArea {
  const bundled = bundledById.get(area.id);
  return {
    ...area,
    groupId: area.groupId ?? bundled?.groupId ?? FALLBACK_GROUP.id,
    weight: area.weight ?? bundled?.weight ?? FALLBACK_WEIGHT,
  };
}

function catalogOf(areas: readonly Area[], groups: readonly Group[]): Catalog {
  const completed = areas.map(complete);
  const used = new Set(completed.map((area) => area.groupId));
  const known = groups.filter((group) => used.has(group.id));
  const missing = [...used].filter((id) => !known.some((group) => group.id === id));
  const extra = missing.map((id) =>
    id === FALLBACK_GROUP.id
      ? FALLBACK_GROUP
      : (BUNDLED_GROUPS.find((group) => group.id === id) ?? { id, name: id }),
  );
  return { groups: [...known, ...extra], areas: completed };
}

/** Catálogo que vem com o app: vale até o primeiro conteúdo baixado. */
export const BUNDLED_CATALOG: Catalog = catalogOf(AREA_CATALOG, BUNDLED_GROUPS);

/**
 * Catálogo do conteúdo publicado; o que faltar (peso, grupo) vem do catálogo embutido, e uma
 * área que o app não conhece entra com peso 1 num grupo à parte.
 */
export function catalogFrom(
  content: { areas: readonly Area[]; groups?: readonly Group[] } | null,
): Catalog {
  if (content === null) return BUNDLED_CATALOG;
  return catalogOf(content.areas, content.groups ?? BUNDLED_GROUPS);
}
