import { z } from 'zod';

import { type Card, cardSchema } from '@/features/content/contract';
import { type Clock, toLocalDateString } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';

export const QUIZ_KEY = 'quiz.v1';

const scoreEntrySchema = z.object({
  date: z.string(),
  score: z.int().min(0),
  total: z.int().min(1),
});

const storedSchema = z.object({
  current: z
    .object({
      date: z.string(),
      questions: z.array(cardSchema),
      score: z.int().min(0).nullable(),
    })
    .nullable(),
  history: z.array(scoreEntrySchema),
});

type Stored = z.infer<typeof storedSchema>;
export type ScoreEntry = z.infer<typeof scoreEntrySchema>;
export type TodaysQuiz = { date: string; questions: Card[]; score: number | null };

const EMPTY: Stored = { current: null, history: [] };

export type QuizRepository = {
  /** Quiz de hoje, ou `null` se ainda não foi preparado hoje. */
  today(): Promise<TodaysQuiz | null>;
  /** Guarda as perguntas de hoje; repetir no mesmo dia mantém as primeiras. */
  prepare(questions: readonly Card[]): Promise<void>;
  /** Registra a pontuação de hoje no histórico. Não mexe na sequência. */
  recordScore(score: number): Promise<void>;
  history(): Promise<ScoreEntry[]>;
};

export function createQuizRepository(store: KeyValueStore, clock: Clock): QuizRepository {
  const read = async (): Promise<Stored> => {
    const raw = await store.getItem(QUIZ_KEY);
    if (raw === null) return EMPTY;
    try {
      return storedSchema.parse(JSON.parse(raw));
    } catch {
      return EMPTY;
    }
  };
  const write = (stored: Stored) => store.setItem(QUIZ_KEY, JSON.stringify(stored));
  const todayString = () => toLocalDateString(clock.now());

  const today = async (): Promise<TodaysQuiz | null> => {
    const { current } = await read();
    return current?.date === todayString() ? current : null;
  };

  return {
    today,
    async prepare(questions) {
      if (await today()) return;
      const stored = await read();
      await write({
        ...stored,
        current: { date: todayString(), questions: [...questions], score: null },
      });
    },
    async recordScore(score) {
      const stored = await read();
      const current = stored.current;
      if (current === null || current.date !== todayString()) return;
      const entry = { date: current.date, score, total: current.questions.length };
      await write({
        current: { ...current, score },
        history: [...stored.history.filter((e) => e.date !== current.date), entry],
      });
    },
    async history() {
      return (await read()).history;
    },
  };
}
