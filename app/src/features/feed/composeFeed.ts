import { type CatalogArea, catalogFrom } from '@/features/content/catalog';
import type { Card, DailyContent } from '@/features/content/contract';
import { FEED_DEFAULTS, type FeedSettings } from './feedSettings';

export type FeedPreferences = {
  areaIds: readonly string[];
  /** Subáreas escolhidas; uma área sem nenhuma subárea listada usa todas. */
  subareaIds?: readonly string[];
};

type AreaSlot = { area: CatalogArea; queue: Card[]; picked: Card[] };

/**
 * Monta o feed do dia: divide o tamanho do feed entre as áreas escolhidas pelo peso de cada
 * uma → pega os cards de cada área por rank → a cota que uma área não preencher vai para as
 * outras, pelos pesos → garante a fatia mínima de artigos → intercala as áreas.
 * Função pura e determinística.
 */
export function composeFeed(
  content: DailyContent,
  preferences: FeedPreferences,
  settings: FeedSettings = FEED_DEFAULTS,
): Card[] {
  const slots = areaSlots(content, preferences);
  fill(slots, settings.feedSize);
  ensurePaperShare(slots, settings.minPaperShare);
  return interleave(slots.map((slot) => slot.picked));
}

function areaSlots(content: DailyContent, preferences: FeedPreferences): AreaSlot[] {
  const catalog = catalogFrom(content);
  const subareaOrder = new Map(
    catalog.areas.flatMap((area) => area.subareas.map((s, i) => [s.id, i] as const)),
  );
  const byRank = (a: Card, b: Card) =>
    a.rank - b.rank ||
    (subareaOrder.get(a.subareaId) ?? 0) - (subareaOrder.get(b.subareaId) ?? 0) ||
    a.id.localeCompare(b.id);

  return catalog.areas
    .filter((area) => preferences.areaIds.includes(area.id))
    .map((area) => {
      const wanted = (preferences.subareaIds ?? []).filter((id) => id.startsWith(`${area.id}.`));
      const queue = content.cards
        .filter((card) => card.areaId === area.id)
        .filter((card) => wanted.length === 0 || wanted.includes(card.subareaId))
        .sort(byRank);
      return { area, queue, picked: [] };
    });
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

/** Distribui as vagas pelos pesos e repassa a sobra às áreas que ainda têm cards. */
function fill(slots: AreaSlot[], feedSize: number): void {
  let missing = feedSize;
  while (missing > 0) {
    const open = slots.filter((slot) => slot.queue.length > 0);
    if (open.length === 0) return;
    const quotas = allocate(
      missing,
      open.map((slot) => slot.area.weight),
    );
    open.forEach((slot, i) => {
      const taken = slot.queue.splice(0, quotas[i]);
      slot.picked.push(...taken);
      missing -= taken.length;
    });
  }
}

/** Troca a pior notícia por um artigo da mesma área ou, se não houver, do mesmo grupo. */
function ensurePaperShare(slots: AreaSlot[], minPaperShare: number): void {
  const feedSize = slots.reduce((acc, slot) => acc + slot.picked.length, 0);
  const minimum = Math.ceil(minPaperShare * feedSize);
  const papers = () =>
    slots.reduce((acc, slot) => acc + slot.picked.filter((c) => c.type === 'paper').length, 0);

  let swapped = true;
  while (papers() < minimum && swapped) {
    swapped = false;
    for (const slot of slots) {
      if (papers() >= minimum) return;
      const newsIndex = worstNewsIndex(slot.picked);
      if (newsIndex < 0) continue;
      const sameGroup = slots.filter((other) => other.area.groupId === slot.area.groupId);
      const paper = takeBestPaper([slot]) ?? takeBestPaper(sameGroup);
      if (paper) {
        slot.picked[newsIndex] = paper;
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

function takeBestPaper(slots: AreaSlot[]): Card | undefined {
  let best: { queue: Card[]; index: number } | undefined;
  for (const { queue } of slots) {
    const index = queue.findIndex((card) => card.type === 'paper');
    if (index >= 0 && (!best || queue[index].rank < best.queue[best.index].rank)) {
      best = { queue, index };
    }
  }
  return best ? best.queue.splice(best.index, 1)[0] : undefined;
}

/** Alterna as áreas no feed final, para dar variedade ao rolar. */
function interleave(lists: Card[][]): Card[] {
  const result: Card[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((list) => list.length)); i++) {
    for (const list of lists) if (i < list.length) result.push(list[i]);
  }
  return result;
}
