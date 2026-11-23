const DAY_MS = 24 * 60 * 60 * 1000;

/** Dia anterior de uma data AAAA-MM-DD (aritmética em UTC: sem efeito de horário de verão). */
export function previousDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date) - DAY_MS).toISOString().slice(0, 10);
}

export type Streak = { current: number; best: number };

/**
 * Sequência de dias concluídos. `today` é o dia no fuso do celular.
 * A sequência atual continua viva enquanto hoje não termina: se ontem foi concluído, ela conta
 * até ontem; perder um dia inteiro zera a sequência.
 */
export function calculateStreak(completedDays: readonly string[], today: string): Streak {
  const days = new Set(completedDays);

  let anchor = days.has(today) ? today : previousDay(today);
  let current = 0;
  while (days.has(anchor)) {
    current += 1;
    anchor = previousDay(anchor);
  }

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...days].sort()) {
    run = previous !== null && previousDay(day) === previous ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  return { current, best };
}
