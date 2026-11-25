import { z } from 'zod';

// Espelho de contracts/daily-content.schema.json, a fonte da verdade. O pipeline valida a
// própria saída de forma estrita; aqui a leitura é tolerante, para que um campo novo ou um card
// ruim publicado depois não deixe o app instalado sem o conteúdo do dia.

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
/** Campos técnicos de artigos (método, resultado, limitações). */
const mediumText = z.string().min(1).max(300);

const quizSchema = z
  .object({
    question: shortText,
    options: z.array(shortText).min(2).max(6),
    answerIndex: z.int().min(0),
  })
  .refine((quiz) => quiz.answerIndex < quiz.options.length, {
    message: 'answerIndex fora das alternativas',
    path: ['answerIndex'],
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

const newsCardSchema = z.object({
  ...cardBase,
  type: z.literal('news'),
});

const paperCardSchema = z.object({
  ...cardBase,
  type: z.literal('paper'),
  originalTitle: z.string().min(1).max(400),
  method: mediumText,
  result: mediumText,
  limitations: mediumText,
  authors: z.array(shortText).min(1).max(3),
  authorsTruncated: z.boolean(),
  venue: shortText,
  isPreprint: z.boolean(),
  pdfUrl: httpsUrl.optional(),
});

export const cardSchema = z.discriminatedUnion('type', [newsCardSchema, paperCardSchema]);

const groupId = z.string().regex(/^[a-z]+(-[a-z]+)*$/);

const groupSchema = z.object({ id: groupId, name: shortText });

// Campos opcionais do catálogo: valor inválido vira ausente, sem derrubar o dia.
const areaSchema = z.object({
  id: areaId,
  name: shortText,
  subareas: z.array(z.object({ id: subareaId, name: shortText })).min(1),
  groupId: groupId.optional().catch(undefined),
  weight: z.number().positive().max(100).optional().catch(undefined),
});

const storySchema = z.object({
  areaId,
  slides: z.array(z.object({ headline: shortText, cardId })).min(1),
});

const envelopeSchema = z.object({
  schemaVersion: z.int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: utcTimestamp,
  groups: z.array(groupSchema).min(1).optional().catch(undefined),
  /** Cada área e cada story são validadas uma a uma em `parseDailyContent`. */
  areas: z.array(z.unknown()),
  /** Validado campo a campo por quem usa, com padrão para o que faltar. */
  settings: z.record(z.string(), z.unknown()).optional().catch(undefined),
  cards: z.array(z.unknown()),
  stories: z.array(z.unknown()),
});

const KNOWN_CARD_TYPES: ReadonlySet<unknown> = new Set(['news', 'paper']);

export type Quiz = z.infer<typeof quizSchema>;
export type NewsCard = z.infer<typeof newsCardSchema>;
export type PaperCard = z.infer<typeof paperCardSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Area = z.infer<typeof areaSchema>;
export type Group = z.infer<typeof groupSchema>;
export type Story = z.infer<typeof storySchema>;
export type DailyContent = Omit<z.infer<typeof envelopeSchema>, 'cards' | 'areas' | 'stories'> & {
  areas: Area[];
  cards: Card[];
  stories: Story[];
};

export type DroppedCard = { index: number; id?: string; reason: string };
export type DroppedArea = { index: number; id?: string; reason: string };
export type DroppedStory = { index: number; areaId?: string; reason: string };
/** O que foi descartado na leitura, para diagnóstico. */
export type ContentDiagnostics = {
  droppedCards: DroppedCard[];
  droppedAreas: DroppedArea[];
  droppedStories: DroppedStory[];
};
export type ParsedDailyContent = DailyContent & { diagnostics: ContentDiagnostics };

/** Maior versão principal do contrato que este app sabe ler. */
export const SUPPORTED_SCHEMA_VERSION = 1;

/** Conteúdo publicado numa versão principal mais nova: só uma versão nova do app consegue ler. */
export class UnsupportedContentVersionError extends Error {
  constructor(readonly schemaVersion: number) {
    super(`versão de contrato ${schemaVersion} não suportada (máximo ${SUPPORTED_SCHEMA_VERSION})`);
    this.name = 'UnsupportedContentVersionError';
  }
}

export class ContractViolationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`${issues.length} violação(ões) do contrato: ${issues.join('; ')}`);
    this.name = 'ContractViolationError';
  }
}

function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '<raiz>'}: ${issue.message}`);
}

function parseCard(raw: unknown, index: number): { card: Card } | { dropped: DroppedCard } {
  const fields = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const id = typeof fields.id === 'string' ? fields.id : undefined;
  const drop = (reason: string) => ({ dropped: { index, ...(id && { id }), reason } });

  if (!KNOWN_CARD_TYPES.has(fields.type)) {
    return drop(`tipo de card desconhecido: ${String(fields.type)}`);
  }
  const result = cardSchema.safeParse(raw);
  return result.success ? { card: result.data } : drop(describeIssues(result.error).join('; '));
}

function stringField(raw: unknown, key: string): string | undefined {
  const value =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>)[key] : undefined;
  return typeof value === 'string' ? value : undefined;
}

/** Valida cada item de uma lista com o schema; o inválido sai sozinho, com o motivo. */
function parseEach<T, D>(
  items: unknown[],
  schema: z.ZodType<T>,
  describeDropped: (raw: unknown, index: number, reason: string) => D,
): { kept: T[]; dropped: D[] } {
  const kept: T[] = [];
  const dropped: D[] = [];
  items.forEach((raw, index) => {
    const result = schema.safeParse(raw);
    if (result.success) kept.push(result.data);
    else dropped.push(describeDropped(raw, index, describeIssues(result.error).join('; ')));
  });
  return { kept, dropped };
}

/** Tira das stories as manchetes de cards que não ficaram no dia; story sem manchete some. */
function keepStoriesOf(stories: Story[], cards: Card[]): Story[] {
  const cardIds = new Set(cards.map((card) => card.id));
  return stories.flatMap((story) => {
    const slides = story.slides.filter((slide) => cardIds.has(slide.cardId));
    return slides.length > 0 ? [{ ...story, slides }] : [];
  });
}

/**
 * Valida um payload desconhecido (ex.: resposta HTTP) e devolve o conteúdo tipado. Campos
 * desconhecidos são ignorados e cada card, story ou área inválida sai sozinha (a área leva
 * seus cards junto); só um envelope inválido, ou um dia sem nenhuma área ou nenhum card válido,
 * recusa o conteúdo inteiro. A versão é conferida antes do resto
 * porque uma versão principal nova pode mudar o formato de tudo.
 */
export function parseDailyContent(input: unknown): ParsedDailyContent {
  const version = (input as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (Number.isInteger(version) && (version as number) > SUPPORTED_SCHEMA_VERSION) {
    throw new UnsupportedContentVersionError(version as number);
  }
  const envelope = envelopeSchema.safeParse(input);
  if (!envelope.success) throw new ContractViolationError(describeIssues(envelope.error));

  const areas = parseEach(envelope.data.areas, areaSchema, (raw, index, reason) => {
    const id = stringField(raw, 'id');
    return { index, ...(id && { id }), reason };
  });
  if (areas.kept.length === 0) {
    throw new ContractViolationError([
      'areas: nenhuma área válida',
      ...areas.dropped.map((d) => d.reason),
    ]);
  }
  const droppedAreaIds = new Set(areas.dropped.flatMap((d) => (d.id ? [d.id] : [])));

  const cards: Card[] = [];
  const droppedCards: DroppedCard[] = [];
  envelope.data.cards.forEach((raw, index) => {
    const parsed = parseCard(raw, index);
    if ('dropped' in parsed) droppedCards.push(parsed.dropped);
    else if (droppedAreaIds.has(parsed.card.areaId)) {
      droppedCards.push({
        index,
        id: parsed.card.id,
        reason: `área descartada: ${parsed.card.areaId}`,
      });
    } else cards.push(parsed.card);
  });
  if (cards.length === 0) {
    throw new ContractViolationError([
      'cards: nenhum card válido',
      ...droppedCards.map((d) => d.reason),
    ]);
  }

  const stories = parseEach(envelope.data.stories, storySchema, (raw, index, reason) => {
    const areaId = stringField(raw, 'areaId');
    return { index, ...(areaId && { areaId }), reason };
  });

  return {
    ...envelope.data,
    areas: areas.kept,
    cards,
    stories: keepStoriesOf(stories.kept, cards),
    diagnostics: { droppedCards, droppedAreas: areas.dropped, droppedStories: stories.dropped },
  };
}
