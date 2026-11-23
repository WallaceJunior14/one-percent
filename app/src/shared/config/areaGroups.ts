// Grupos de áreas usados para dividir o feed. É personalização: fica no app, fora do contrato.

export type GroupId = 'sci-tech' | 'markets-health';

export type AreaGroup = { id: GroupId; name: string; areaIds: readonly string[] };

/** A ordem importa: em empate no arredondamento, o primeiro grupo leva o card extra. */
export const AREA_GROUPS: readonly AreaGroup[] = [
  { id: 'sci-tech', name: 'Ciência & Tecnologia', areaIds: ['tech', 'science'] },
  { id: 'markets-health', name: 'Mercado & Saúde', areaIds: ['economy', 'finance', 'health'] },
];

export type GroupWeights = Record<GroupId, number>;

/** Divisão padrão do feed entre os grupos. */
export const DEFAULT_GROUP_WEIGHTS: GroupWeights = { 'sci-tech': 0.5, 'markets-health': 0.5 };
