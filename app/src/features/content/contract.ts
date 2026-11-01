import { z } from 'zod';

// Espelho de contracts/daily-content.schema.json (fonte da verdade, ADR 0001).
// Os testes deste módulo usam o mesmo sample-day.json e os mesmos casos inválidos
// que os testes do pipeline, para manter os dois validadores em sincronia.

const utcTimestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
const areaId = z.string().regex(/^[a-z]+$/);
const subareaId = z.string().regex(/^[a-z]+\.[a-z0-9-]+$/);
const cardId = z.string().regex(/^c_[0-9a-f]{12}$/);
const httpsUrl = z
  .string()
  .max(2048)
  .regex(/^https:\/\/\S+$/);
const shortText = z.string().min(1).max(200);
const longText = z.string().min(1).max(600);

const quizSchema = z.strictObject({
  question: shortText,
  options: z.array(shortText).length(4),
  answerIndex: z.int().min(0).max(3),
});

const cardBase = {
  id: cardId,
  areaId,
  subareaId,
  rank: z.int().min(1),
  title: shortText,
  summary: longText,
  whyItMatters: shortText,
  sourceName: shortText,
  url: httpsUrl,
  publishedAt: utcTimestamp,
  quiz: quizSchema,
};

const newsCardSchema = z.strictObject({
  ...cardBase,
  type: z.literal('news'),
});

const paperCardSchema = z.strictObject({
  ...cardBase,
  type: z.literal('paper'),
  originalTitle: z.string().min(1).max(400),
  method: shortText,
  result: shortText,
  limitations: shortText,
  authors: z.array(shortText).min(1).max(3),
  authorsTruncated: z.boolean(),
  venue: shortText,
  isPreprint: z.boolean(),
  pdfUrl: httpsUrl.optional(),
});

const cardSchema = z.discriminatedUnion('type', [newsCardSchema, paperCardSchema]);

const areaSchema = z.strictObject({
  id: areaId,
  name: shortText,
  subareas: z.array(z.strictObject({ id: subareaId, name: shortText })).min(1),
});

const storySchema = z.strictObject({
  areaId,
  slides: z
    .array(z.strictObject({ headline: shortText, cardId }))
    .min(3)
    .max(5),
});

const dailyContentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: utcTimestamp,
  areas: z.array(areaSchema).min(1),
  cards: z.array(cardSchema).min(1),
  stories: z.array(storySchema),
});

export type Quiz = z.infer<typeof quizSchema>;
export type NewsCard = z.infer<typeof newsCardSchema>;
export type PaperCard = z.infer<typeof paperCardSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Area = z.infer<typeof areaSchema>;
export type Story = z.infer<typeof storySchema>;
export type DailyContent = z.infer<typeof dailyContentSchema>;

export class ContractViolationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`${issues.length} violação(ões) do contrato: ${issues.join('; ')}`);
    this.name = 'ContractViolationError';
  }
}

/** Valida um payload desconhecido (ex.: resposta HTTP) e devolve o conteúdo tipado. */
export function parseDailyContent(input: unknown): DailyContent {
  const result = dailyContentSchema.safeParse(input);
  if (!result.success) {
    throw new ContractViolationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '<raiz>'}: ${issue.message}`),
    );
  }
  return result.data;
}
