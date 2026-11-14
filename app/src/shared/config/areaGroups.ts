// Grupos de áreas para compor o feed (RF-011). Conceito de personalização: fica no app,
// e o contrato do conteúdo não precisa conhecê-lo (ADR 0001).

export type GroupId = 'sci-tech' | 'markets-health';

export type AreaGroup = { id: GroupId; name: string; areaIds: readonly string[] };

/** A ordem importa: em empate no arredondamento, o primeiro grupo leva o card extra. */
export const AREA_GROUPS: readonly AreaGroup[] = [
  { id: 'sci-tech', name: 'Ciência & Tecnologia', areaIds: ['tech', 'science'] },
  { id: 'markets-health', name: 'Mercado & Saúde', areaIds: ['economy', 'finance', 'health'] },
];

export type GroupWeights = Record<GroupId, number>;

/** Padrão do MVP: metade para cada grupo. Configurável pelo usuário no futuro. */
export const DEFAULT_GROUP_WEIGHTS: GroupWeights = { 'sci-tech': 0.5, 'markets-health': 0.5 };
