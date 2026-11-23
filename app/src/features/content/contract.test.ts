import sampleDay from '../../../../contracts/examples/sample-day.json';
import { ContractViolationError, parseDailyContent } from './contract';

type MutableDay = {
  date: string;
  cards: Record<string, unknown>[];
  stories: { slides: unknown[] }[];
};

function mutatedSample(mutate: (day: MutableDay) => void): unknown {
  const day = structuredClone(sampleDay) as unknown as MutableDay;
  mutate(day);
  return day;
}

function firstCardOfType(day: MutableDay, type: 'news' | 'paper') {
  const card = day.cards.find((c) => c.type === type);
  if (!card) throw new Error(`sample has no ${type} card`);
  return card;
}

test('parses_sample_day', () => {
  const content = parseDailyContent(sampleDay);

  expect(content.date).toBe('2026-11-01');
  expect(content.cards).toHaveLength(22);
  expect(content.stories).toHaveLength(5);
});

test('narrows_paper_cards_to_their_specific_fields', () => {
  const content = parseDailyContent(sampleDay);
  const paper = content.cards.find((card) => card.type === 'paper');

  expect(paper?.type === 'paper' && paper.method.length > 0).toBe(true);
});

function cardIds(input: unknown): string[] {
  return parseDailyContent(input).cards.map((card) => card.id);
}

test('ignores_unknown_fields', () => {
  const day = mutatedSample((d) => {
    (d as unknown as Record<string, unknown>).catalogVersion = 7;
    d.cards[0].html = '<b>injetado</b>';
    (d.cards[0].quiz as Record<string, unknown>).hint = 'novo';
    (d.stories[0] as Record<string, unknown>).cover = 'https://example.com/a.png';
  });

  const content = parseDailyContent(day);

  expect(content.cards).toHaveLength(22);
  expect(content.cards[0]).not.toHaveProperty('html');
  expect(content.cards[0].quiz).not.toHaveProperty('hint');
  expect(content).not.toHaveProperty('catalogVersion');
  expect(content.diagnostics.droppedCards).toEqual([]);
});

describe('drops_only_the_invalid_card', () => {
  test.each<[string, (card: Record<string, unknown>) => void]>([
    ['quiz with three options', (card) => (card.quiz as { options: string[] }).options.pop()],
    [
      'quiz answer out of range',
      (card) => ((card.quiz as { answerIndex: number }).answerIndex = 4),
    ],
    ['http url', (card) => (card.url = 'http://example.com/news')],
    ['javascript url', (card) => (card.url = 'javascript:alert(1)')],
    ['news with missing title', (card) => delete card.title],
  ])('%s', (_name, mutate) => {
    const day = mutatedSample((d) => mutate(d.cards[0]));

    const content = parseDailyContent(day);

    expect(content.cards).toHaveLength(21);
    expect(content.cards.map((card) => card.id)).not.toContain('c_000000000001');
    expect(content.diagnostics.droppedCards).toEqual([
      { index: 0, id: 'c_000000000001', reason: expect.any(String) },
    ]);
  });

  test('paper without method', () => {
    const day = mutatedSample((d) => delete firstCardOfType(d, 'paper').method);

    expect(cardIds(day)).not.toContain('c_000000000003');
    expect(cardIds(day)).toHaveLength(21);
  });

  test('reason_points_to_the_invalid_field', () => {
    const day = mutatedSample((d) => (d.cards[0].url = 'http://example.com'));

    expect(parseDailyContent(day).diagnostics.droppedCards[0].reason).toMatch(/^url: /);
  });
});

test('drops_unknown_card_types', () => {
  const day = mutatedSample((d) => {
    d.cards[0].type = 'video';
    d.cards.push({ type: 'poll', id: 'c_00000000ffff' });
  });

  const content = parseDailyContent(day);

  expect(content.cards).toHaveLength(21);
  expect(content.diagnostics.droppedCards).toEqual([
    { index: 0, id: 'c_000000000001', reason: 'tipo de card desconhecido: video' },
    { index: 22, id: 'c_00000000ffff', reason: 'tipo de card desconhecido: poll' },
  ]);
});

describe('drops_story_slides_of_dropped_cards', () => {
  test('story keeps only the headlines of valid cards', () => {
    const day = mutatedSample((d) => (d.cards[0].url = 'http://example.com'));

    const tech = parseDailyContent(day).stories.find((story) => story.areaId === 'tech');

    expect(tech?.slides.map((slide) => slide.cardId)).toEqual([
      'c_000000000002',
      'c_000000000007',
      'c_000000000005',
    ]);
  });

  test('story without any valid headline is removed', () => {
    const day = mutatedSample((d) => {
      const techIds = new Set(
        (d.stories[0].slides as { cardId: string }[]).map((slide) => slide.cardId),
      );
      for (const card of d.cards) if (techIds.has(card.id as string)) card.type = 'video';
    });

    const content = parseDailyContent(day);

    expect(content.stories).toHaveLength(4);
    expect(content.stories.map((story) => story.areaId)).not.toContain('tech');
  });
});

describe('rejects_invalid_payload', () => {
  test.each<[string, (day: MutableDay) => void]>([
    ['story with two slides', (day) => (day.stories[0].slides = day.stories[0].slides.slice(0, 2))],
    ['no valid card left', (day) => day.cards.forEach((card) => (card.type = 'video'))],
    ['cards is not a list', (day) => ((day as unknown as { cards: unknown }).cards = {})],
  ])('%s', (_name, mutate) => {
    expect(() => parseDailyContent(mutatedSample(mutate))).toThrow(ContractViolationError);
  });

  test('non object payload', () => {
    expect(() => parseDailyContent('not json')).toThrow(ContractViolationError);
  });
});

test('error_message_points_to_the_invalid_field', () => {
  const invalid = mutatedSample((day) => (day.date = '01/11/2026'));

  expect(() => parseDailyContent(invalid)).toThrow(/date: /);
});

describe('paper_scientific_fields_limits', () => {
  test.each(['method', 'result', 'limitations'])('%s accepts 300 chars', (field) => {
    const day = mutatedSample((d) => (firstCardOfType(d, 'paper')[field] = 'x'.repeat(300)));

    expect(() => parseDailyContent(day)).not.toThrow();
  });

  test.each(['method', 'result', 'limitations'])('%s rejects 301 chars', (field) => {
    const day = mutatedSample((d) => (firstCardOfType(d, 'paper')[field] = 'x'.repeat(301)));

    expect(cardIds(day)).not.toContain('c_000000000003');
  });
});
