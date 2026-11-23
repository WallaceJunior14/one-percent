import type { ScoreEntry } from './quizRepository';

/** Acertos sobre perguntas respondidas em todo o histórico, em % arredondado; `null` sem quiz. */
export function quizAverage(history: readonly ScoreEntry[]): number | null {
  const questions = history.reduce((sum, entry) => sum + entry.total, 0);
  if (questions === 0) return null;
  const correct = history.reduce((sum, entry) => sum + entry.score, 0);
  return Math.round((correct / questions) * 100);
}
