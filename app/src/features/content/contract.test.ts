import pipelineOutput from '../../../../contracts/examples/pipeline-output.json';
import sampleDay from '../../../../contracts/examples/sample-day.json';
import {
  ContractViolationError,
  parseDailyContent,
  SUPPORTED_SCHEMA_VERSION,
  UnsupportedContentVersionError,
} from './contract';

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
    ['quiz with one option', (card) => ((card.quiz as { options: string[] }).options = ['Só uma'])],
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

describe('schema_version', () => {
  test('rejects_newer_major_version', () => {
    const newer = { schemaVersion: SUPPORTED_SCHEMA_VERSION + 1, cards: 'formato novo' };

    expect(() => parseDailyContent(newer)).toThrow(UnsupportedContentVersionError);
  });

  test.each([0, 1.5, '1'])('rejects invalid version %p', (schemaVersion) => {
    const day = mutatedSample(
      (d) => ((d as unknown as { schemaVersion: unknown }).schemaVersion = schemaVersion),
    );

    expect(() => parseDailyContent(day)).toThrow(ContractViolationError);
  });
});

describe('rejects_invalid_payload', () => {
  test.each<[string, (day: MutableDay) => void]>([
    ['story without slides', (day) => (day.stories[0].slides = [])],
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

describe('catalog_and_settings', () => {
  test('parses_groups_weights_and_settings', () => {
    const content = parseDailyContent(sampleDay);

    expect(content.groups?.map((group) => group.id)).toEqual(['sci-tech', 'markets-health']);
    expect(content.areas.find((area) => area.id === 'tech')).toMatchObject({
      groupId: 'sci-tech',
      weight: 3,
    });
    expect(content.settings).toMatchObject({ feedSize: 15 });
  });

  test('payload_without_new_fields_still_parses', () => {
    const old = mutatedSample((day) => {
      const raw = day as unknown as Record<string, unknown> & { areas: Record<string, unknown>[] };
      delete raw.groups;
      delete raw.settings;
      raw.areas.forEach((area) => {
        delete area.groupId;
        delete area.weight;
      });
    });

    const content = parseDailyContent(old);

    expect(content.groups).toBeUndefined();
    expect(content.areas[0].weight).toBeUndefined();
  });

  test('invalid_weight_or_groups_are_ignored_not_fatal', () => {
    const day = mutatedSample((d) => {
      const raw = d as unknown as Record<string, unknown> & { areas: Record<string, unknown>[] };
      raw.areas[0].weight = -1;
      raw.groups = 'nope';
    });

    const content = parseDailyContent(day);

    expect(content.areas[0].weight).toBeUndefined();
    expect(content.groups).toBeUndefined();
    expect(content.cards.length).toBeGreaterThan(0);
  });
});

describe('quiz_options', () => {
  test('accepts_two_options', () => {
    const day = mutatedSample((d) => {
      d.cards[0].quiz = { question: 'Pergunta?', options: ['Sim', 'Não'], answerIndex: 1 };
    });

    expect(parseDailyContent(day).cards[0].quiz.options).toHaveLength(2);
  });

  test('drops_card_whose_answer_is_not_an_option', () => {
    const day = mutatedSample((d) => {
      d.cards[0].quiz = { question: 'Pergunta?', options: ['Sim', 'Não'], answerIndex: 2 };
    });

    expect(parseDailyContent(day).diagnostics.droppedCards).toHaveLength(1);
  });
});

test('reads_pipeline_output_fixture', () => {
  const content = parseDailyContent(pipelineOutput);

  expect(content.diagnostics.droppedCards).toEqual([]);
  expect(content.cards).toHaveLength(pipelineOutput.cards.length);
  expect(content.settings).toEqual(pipelineOutput.settings);
});
