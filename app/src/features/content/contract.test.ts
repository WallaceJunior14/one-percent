import sampleDay from '../../../../contracts/examples/sample-day.json';
import { ContractViolationError, parseDailyContent } from './contract';

type MutableDay = {
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

describe('rejects_invalid_payload', () => {
  test.each<[string, (day: MutableDay) => void]>([
    ['paper without method', (day) => delete firstCardOfType(day, 'paper').method],
    ['news with paper fields', (day) => (firstCardOfType(day, 'news').isPreprint = true)],
    [
      'quiz with three options',
      (day) => (day.cards[0].quiz as { options: string[] }).options.pop(),
    ],
    [
      'quiz answer out of range',
      (day) => ((day.cards[0].quiz as { answerIndex: number }).answerIndex = 4),
    ],
    ['http url', (day) => (day.cards[0].url = 'http://example.com/news')],
    ['javascript url', (day) => (day.cards[0].url = 'javascript:alert(1)')],
    ['unknown card type', (day) => (day.cards[0].type = 'video')],
    ['unexpected field', (day) => (day.cards[0].html = '<b>injetado</b>')],
    ['story with two slides', (day) => (day.stories[0].slides = day.stories[0].slides.slice(0, 2))],
  ])('%s', (_name, mutate) => {
    expect(() => parseDailyContent(mutatedSample(mutate))).toThrow(ContractViolationError);
  });

  test('non object payload', () => {
    expect(() => parseDailyContent('not json')).toThrow(ContractViolationError);
  });
});

test('error_message_points_to_the_invalid_field', () => {
  const invalid = mutatedSample((day) => (day.cards[0].url = 'http://example.com'));

  expect(() => parseDailyContent(invalid)).toThrow(/cards\.0\.url/);
});
