import type { Card, DailyContent } from '@/features/content/contract';
import {
  AREA_GROUPS,
  DEFAULT_GROUP_WEIGHTS,
  type GroupId,
  type GroupWeights,
} from '@/shared/config/areaGroups';

export const FEED_SIZE = 15;
export const MIN_PAPER_SHARE = 0.3;

export type FeedPreferences = {
  areaIds: readonly string[];
  /** Subáreas escolhidas; uma área sem nenhuma subárea listada usa todas. */
  subareaIds?: readonly string[];
};

type ActiveGroup = { id: GroupId; queues: Card[][]; picked: Card[] };

/**
 * Monta o feed do dia:
 * cotas por grupo de áreas → rodízio entre as áreas do grupo por rank → sobra de um grupo vai
 * para o outro → garantia de artigos dentro do mesmo grupo. Função pura e determinística.
 */
export function composeFeed(
  content: DailyContent,
  preferences: FeedPreferences,
  weights: GroupWeights = DEFAULT_GROUP_WEIGHTS,
): Card[] {
  const groups = activeGroups(content, preferences);
  const quotas = allocate(
    FEED_SIZE,
    groups.map((group) => weights[group.id] ?? 0),
  );

  groups.forEach((group, i) => group.picked.push(...takeRoundRobin(group.queues, quotas[i])));
  fillShortfall(groups);
  ensurePaperShare(groups);

  return interleave(groups.map((group) => group.picked));
}

function activeGroups(content: DailyContent, preferences: FeedPreferences): ActiveGroup[] {
  const subareaOrder = new Map(
    content.areas.flatMap((area) => area.subareas.map((s, i) => [s.id, i] as const)),
  );
  const byRank = (a: Card, b: Card) =>
    a.rank - b.rank ||
    (subareaOrder.get(a.subareaId) ?? 0) - (subareaOrder.get(b.subareaId) ?? 0) ||
    a.id.localeCompare(b.id);

  const queueFor = (areaId: string): Card[] => {
    const wanted = (preferences.subareaIds ?? []).filter((id) => id.startsWith(`${areaId}.`));
    return content.cards
      .filter((card) => card.areaId === areaId)
      .filter((card) => wanted.length === 0 || wanted.includes(card.subareaId))
      .sort(byRank);
  };

  return AREA_GROUPS.map((group) => ({
    id: group.id,
    queues: group.areaIds.filter((id) => preferences.areaIds.includes(id)).map(queueFor),
    picked: [],
  })).filter((group) => group.queues.length > 0);
}

/** Divide `total` proporcionalmente aos pesos (método do maior resto; empate → primeiro). */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  const shares = weights.map((w) => (sum > 0 ? (total * w) / sum : total / weights.length));
  const quotas = shares.map(Math.floor);
  const byRemainder = shares
    .map((share, i) => ({ i, remainder: share - Math.floor(share) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const leftover = total - quotas.reduce((acc, q) => acc + q, 0);
  for (let k = 0; k < leftover; k++) {
    quotas[byRemainder[k % byRemainder.length].i] += 1;
  }
  return quotas;
}

/** Tira até `count` cards alternando entre as filas (consome as filas). */
function takeRoundRobin(queues: Card[][], count: number): Card[] {
  const taken: Card[] = [];
  while (taken.length < count && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      if (taken.length === count) break;
      const card = queue.shift();
      if (card) taken.push(card);
    }
  }
  return taken;
}

/** Se um grupo não preencheu a cota, os outros completam até o tamanho do feed. */
function fillShortfall(groups: ActiveGroup[]): void {
  let missing = FEED_SIZE - groups.reduce((acc, group) => acc + group.picked.length, 0);
  for (const group of groups) {
    if (missing <= 0) return;
    const extra = takeRoundRobin(group.queues, missing);
    group.picked.push(...extra);
    missing -= extra.length;
  }
}

/** Garante a fatia mínima de artigos trocando a pior notícia por um artigo do mesmo grupo. */
function ensurePaperShare(groups: ActiveGroup[]): void {
  const feedSize = groups.reduce((acc, group) => acc + group.picked.length, 0);
  const minimum = Math.ceil(MIN_PAPER_SHARE * feedSize);
  const papers = () =>
    groups.reduce((acc, g) => acc + g.picked.filter((c) => c.type === 'paper').length, 0);

  let swapped = true;
  while (papers() < minimum && swapped) {
    swapped = false;
    for (const group of groups) {
      if (papers() >= minimum) return;
      const newsIndex = worstNewsIndex(group.picked);
      const paper = newsIndex >= 0 ? takeBestPaper(group.queues) : undefined;
      if (paper) {
        group.picked[newsIndex] = paper;
        swapped = true;
      }
    }
  }
}

function worstNewsIndex(cards: Card[]): number {
  let worst = -1;
  cards.forEach((card, i) => {
    if (card.type === 'news' && (worst < 0 || card.rank >= cards[worst].rank)) worst = i;
  });
  return worst;
}

function takeBestPaper(queues: Card[][]): Card | undefined {
  let best: { queue: Card[]; index: number } | undefined;
  for (const queue of queues) {
    const index = queue.findIndex((card) => card.type === 'paper');
    if (index >= 0 && (!best || queue[index].rank < best.queue[best.index].rank)) {
      best = { queue, index };
    }
  }
  return best ? best.queue.splice(best.index, 1)[0] : undefined;
}

/** Alterna os grupos no feed final, para dar variedade ao rolar. */
function interleave(lists: Card[][]): Card[] {
  const result: Card[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((list) => list.length)); i++) {
    for (const list of lists) if (i < list.length) result.push(list[i]);
  }
  return result;
}
