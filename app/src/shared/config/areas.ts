import type { Area } from '@/features/content/contract';

/**
 * Áreas e subáreas oferecidas no onboarding, antes do primeiro download do conteúdo.
 * Espelha `pipeline/src/one_percent/config/areas.yaml`; testes nos dois lados comparam com
 * `contracts/examples/sample-day.json` para as três listas não divergirem.
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
