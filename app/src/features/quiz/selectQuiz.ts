import type { Card } from '@/features/content/contract';

export const QUIZ_SIZE = 3;

/**
 * Escolhe as perguntas do quiz do dia: alterna entre as áreas do feed, na ordem em que
 * aparecem, para cobrir assuntos diferentes; dentro de cada área, segue a ordem do feed.
 */
export function selectQuiz(feed: readonly Card[], size = QUIZ_SIZE): Card[] {
  const queues = new Map<string, Card[]>();
  for (const card of feed) {
    queues.set(card.areaId, [...(queues.get(card.areaId) ?? []), card]);
  }

  const picked: Card[] = [];
  while (picked.length < size && [...queues.values()].some((queue) => queue.length > 0)) {
    for (const queue of queues.values()) {
      const card = queue.shift();
      if (card) picked.push(card);
      if (picked.length === size) break;
    }
  }
  return picked;
}
