import type { Area } from '@/features/content/contract';

/**
 * Áreas oferecidas no onboarding, antes do primeiro download do conteúdo. Espelha a
 * configuração do pipeline; testes nos dois lados comparam com o exemplo do contrato.
 */
export const AREA_CATALOG: readonly Area[] = [
  {
    id: 'tech',
    name: 'Tecnologia',
    subareas: [
      { id: 'tech.ai', name: 'IA' },
      { id: 'tech.dev', name: 'Desenvolvimento de software' },
      { id: 'tech.security', name: 'Segurança' },
      { id: 'tech.hardware', name: 'Hardware' },
    ],
  },
  {
    id: 'science',
    name: 'Ciência',
    subareas: [
      { id: 'science.ml', name: 'IA/ML' },
      { id: 'science.computing', name: 'Computação' },
      { id: 'science.physics', name: 'Física' },
      { id: 'science.biology', name: 'Biologia' },
    ],
  },
  {
    id: 'economy',
    name: 'Economia',
    subareas: [
      { id: 'economy.brazil', name: 'Brasil' },
      { id: 'economy.world', name: 'Mundo' },
    ],
  },
  {
    id: 'finance',
    name: 'Finanças',
    subareas: [
      { id: 'finance.markets', name: 'Mercado' },
      { id: 'finance.investing', name: 'Investimentos' },
      { id: 'finance.personal', name: 'Finanças pessoais' },
    ],
  },
  {
    id: 'health',
    name: 'Saúde',
    subareas: [
      { id: 'health.medicine', name: 'Medicina' },
      { id: 'health.nutrition', name: 'Nutrição' },
      { id: 'health.mental', name: 'Saúde mental' },
    ],
  },
];

export const AREA_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  AREA_CATALOG.map((area) => [area.id, area.name]),
);
