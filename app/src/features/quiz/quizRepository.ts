import { z } from 'zod';

import { type Card, cardSchema } from '@/features/content/contract';
import { type Clock, toLocalDateString } from '@/shared/lib/dates';
import type { KeyValueStore } from '@/shared/lib/keyValueStore';
import { createVersionedStore, sameFormat } from '@/shared/lib/versionedStore';

export const QUIZ_KEY = 'quiz';

const scoreEntrySchema = z.object({
  date: z.string(),
  score: z.int().min(0),
  total: z.int().min(1),
});

const storedSchema = z.object({
  // O quiz do dia é refeito a cada dia: se as perguntas guardadas deixarem de passar no leitor
  // do contrato, só elas são descartadas, e o histórico continua legível.
  current: z
    .object({
      date: z.string(),
      questions: z.array(cardSchema),
      score: z.int().min(0).nullable(),
    })
    .nullable()
    .catch(null),
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
  const stored = createVersionedStore({
    store,
    clock,
    key: QUIZ_KEY,
    version: 2,
    schema: storedSchema,
    migrations: { 1: sameFormat },
    legacyKeys: ['quiz.v1'],
  });
  const read = async (): Promise<Stored> => (await stored.read()) ?? EMPTY;
  const write = (value: Stored) => stored.write(value);
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
