import sampleDay from '../../../../contracts/examples/sample-day.json';
import { type Card, type DailyContent, parseDailyContent } from '@/features/content/contract';
import { allocate, composeFeed, FEED_SIZE } from './composeFeed';

const SAMPLE = parseDailyContent(sampleDay);
const NEWS_TEMPLATE = SAMPLE.cards.find((card) => card.type === 'news')!;
const PAPER_TEMPLATE = SAMPLE.cards.find((card) => card.type === 'paper')!;

type CardSpec = [subareaId: string, type: Card['type'], count: number];

/** Conteúdo sintético: `count` cards por subárea/tipo, com rank 1..count. */
function buildContent(specs: CardSpec[]): DailyContent {
  let next = 0;
  const cards = specs.flatMap(([subareaId, type, count]) =>
    Array.from({ length: count }, (_, i) => {
      next += 1;
      const template = type === 'paper' ? PAPER_TEMPLATE : NEWS_TEMPLATE;
      return {
        ...template,
        id: `c_${next.toString(16).padStart(12, '0')}`,
        areaId: subareaId.split('.')[0],
        subareaId,
        rank: i + 1,
      } as Card;
    }),
  );
  return { ...SAMPLE, cards, stories: [] };
}

const ALL_AREAS = { areaIds: ['tech', 'science', 'economy', 'finance', 'health'] };
const groupOf = (card: Card) => (['tech', 'science'].includes(card.areaId) ? 'sci' : 'mkt');
const countBy = <T>(items: T[], key: (item: T) => string) =>
  items.reduce<Record<string, number>>((acc, item) => {
    acc[key(item)] = (acc[key(item)] ?? 0) + 1;
    return acc;
  }, {});

const ABUNDANT = buildContent([
  ['tech.ai', 'news', 6],
  ['tech.ai', 'paper', 6],
  ['science.ml', 'paper', 6],
  ['economy.brazil', 'news', 6],
  ['finance.markets', 'news', 6],
  ['health.medicine', 'news', 6],
  ['health.medicine', 'paper', 6],
]);

test('returns_15_cards', () => {
  expect(composeFeed(SAMPLE, ALL_AREAS)).toHaveLength(FEED_SIZE);
  expect(FEED_SIZE).toBe(15);
});

test('only_selected_areas', () => {
  const feed = composeFeed(ABUNDANT, { areaIds: ['tech', 'health'] });

  expect(new Set(feed.map((card) => card.areaId))).toEqual(new Set(['tech', 'health']));
});

test('only_selected_subareas_when_given', () => {
  const content = buildContent([
    ['tech.ai', 'news', 10],
    ['tech.security', 'news', 10],
  ]);

  const feed = composeFeed(content, { areaIds: ['tech'], subareaIds: ['tech.security'] });

  expect(feed.every((card) => card.subareaId === 'tech.security')).toBe(true);
});

test('splits_50_50_between_groups', () => {
  const counts = countBy(composeFeed(ABUNDANT, ALL_AREAS), groupOf);

  expect(Math.abs(counts.sci - counts.mkt)).toBe(1);
});

test('extra_card_goes_to_science_and_technology', () => {
  expect(countBy(composeFeed(ABUNDANT, ALL_AREAS), groupOf)).toEqual({ sci: 8, mkt: 7 });
});

test('single_group_gets_all_cards', () => {
  const feed = composeFeed(ABUNDANT, { areaIds: ['economy', 'finance', 'health'] });

  expect(feed).toHaveLength(FEED_SIZE);
  expect(feed.every((card) => groupOf(card) === 'mkt')).toBe(true);
});

test('rotates_areas_within_group', () => {
  const feed = composeFeed(ABUNDANT, { areaIds: ['economy', 'finance', 'health'] });

  expect(feed.slice(0, 6).map((card) => card.areaId)).toEqual([
    'economy',
    'finance',
    'health',
    'economy',
    'finance',
    'health',
  ]);
});

test('short_group_is_filled_by_the_other', () => {
  const content = buildContent([
    ['tech.ai', 'news', 10],
    ['science.ml', 'paper', 10],
    ['economy.brazil', 'news', 2],
  ]);

  const counts = countBy(composeFeed(content, ALL_AREAS), groupOf);

  expect(counts).toEqual({ sci: 13, mkt: 2 });
});

test('custom_group_weights_are_respected', () => {
  const feed = composeFeed(ABUNDANT, ALL_AREAS, { 'sci-tech': 0.8, 'markets-health': 0.2 });

  expect(countBy(feed, groupOf)).toEqual({ sci: 12, mkt: 3 });
});

test('at_least_30_percent_papers', () => {
  const content = buildContent([
    ['tech.ai', 'news', 10],
    ['tech.ai', 'paper', 10],
    ['economy.brazil', 'news', 10],
  ]);

  const feed = composeFeed(content, { areaIds: ['tech', 'economy'] });

  expect(feed.filter((card) => card.type === 'paper').length).toBeGreaterThanOrEqual(5);
  expect(countBy(feed, groupOf)).toEqual({ sci: 8, mkt: 7 });
});

test('prefers_best_ranked_cards', () => {
  const feed = composeFeed(ABUNDANT, { areaIds: ['economy'] });

  expect(feed.map((card) => card.rank)).toEqual([1, 2, 3, 4, 5, 6]);
});

test('returns_all_available_when_fewer_than_15', () => {
  expect(composeFeed(ABUNDANT, { areaIds: ['economy'] })).toHaveLength(6);
});

test('allocates_leftover_cards_by_largest_remainder', () => {
  expect(allocate(17, [1, 1, 1])).toEqual([6, 6, 5]);
  expect(allocate(15, [0.5, 0.5])).toEqual([8, 7]);
  expect(allocate(15, [0, 0])).toEqual([8, 7]);
});

test('same_input_same_output', () => {
  expect(composeFeed(ABUNDANT, ALL_AREAS)).toEqual(composeFeed(ABUNDANT, ALL_AREAS));
});
