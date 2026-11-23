import sampleDay from '../../../../contracts/examples/sample-day.json';
import { type Card, type DailyContent, parseDailyContent } from '@/features/content/contract';
import { allocate, composeFeed } from './composeFeed';
import { FEED_DEFAULTS } from './feedSettings';

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

/** Mesmo conteúdo, com os pesos dados; área fora da lista fica sem peso publicado. */
function withWeights(content: DailyContent, weights: Record<string, number>): DailyContent {
  return {
    ...content,
    areas: content.areas.map(({ weight: _weight, ...area }) =>
      area.id in weights ? { ...area, weight: weights[area.id] } : area,
    ),
  };
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

test('returns_the_configured_feed_size', () => {
  expect(composeFeed(SAMPLE, ALL_AREAS)).toHaveLength(FEED_DEFAULTS.feedSize);
  expect(composeFeed(ABUNDANT, ALL_AREAS, { ...FEED_DEFAULTS, feedSize: 10 })).toHaveLength(10);
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

test('all_areas_with_default_weights_keep_half_per_group', () => {
  expect(countBy(composeFeed(ABUNDANT, ALL_AREAS), groupOf)).toEqual({ sci: 8, mkt: 7 });
});

test('splits_by_area_weight', () => {
  const feed = composeFeed(ABUNDANT, { areaIds: ['tech', 'economy'] });

  expect(countBy(feed, (card) => card.areaId)).toEqual({ tech: 9, economy: 6 });
});

test('uses_weights_published_in_the_content', () => {
  const content = withWeights(ABUNDANT, { tech: 1, health: 1 });

  const feed = composeFeed(content, { areaIds: ['tech', 'health'] });

  expect(countBy(feed, (card) => card.areaId)).toEqual({ tech: 8, health: 7 });
});

test('falls_back_to_bundled_weights_when_the_content_has_none', () => {
  const content = withWeights(ABUNDANT, {});

  expect(countBy(composeFeed(content, ALL_AREAS), groupOf)).toEqual({ sci: 8, mkt: 7 });
});

test('subareas_have_no_weight', () => {
  const content = buildContent([
    ['tech.ai', 'news', 10],
    ['tech.security', 'news', 2],
  ]);

  const feed = composeFeed(content, { areaIds: ['tech'] });

  expect(countBy(feed, (card) => card.subareaId)).toEqual({ 'tech.ai': 10, 'tech.security': 2 });
});

test('rotates_between_areas', () => {
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

test('redistributes_shortfall_by_weight', () => {
  const content = buildContent([
    ['tech.ai', 'news', 10],
    ['science.ml', 'paper', 10],
    ['economy.brazil', 'news', 2],
  ]);

  const feed = composeFeed(content, { areaIds: ['tech', 'science', 'economy'] });

  expect(countBy(feed, (card) => card.areaId)).toEqual({ tech: 7, science: 6, economy: 2 });
});

test('guarantees_the_configured_paper_share', () => {
  const content = buildContent([
    ['tech.ai', 'news', 10],
    ['tech.ai', 'paper', 10],
    ['economy.brazil', 'news', 10],
  ]);
  const papers = (minPaperShare: number) =>
    composeFeed(
      content,
      { areaIds: ['tech', 'economy'] },
      { ...FEED_DEFAULTS, minPaperShare },
    ).filter((card) => card.type === 'paper').length;

  expect(papers(0.3)).toBeGreaterThanOrEqual(5);
  expect(papers(0.6)).toBeGreaterThanOrEqual(9);
});

test('prefers_best_ranked_cards', () => {
  const feed = composeFeed(ABUNDANT, { areaIds: ['economy'] });

  expect(feed.map((card) => card.rank)).toEqual([1, 2, 3, 4, 5, 6]);
});

test('returns_all_available_when_fewer_than_the_feed_size', () => {
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
