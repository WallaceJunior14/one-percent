import pipelineOutput from '../../../../contracts/examples/pipeline-output.json';
import { estimatedMinutes, FEED_DEFAULTS, resolveFeedSettings } from './feedSettings';

test('falls_back_to_defaults', () => {
  expect(resolveFeedSettings(undefined)).toEqual(FEED_DEFAULTS);
  expect(resolveFeedSettings({ feedSize: 12 })).toEqual({ ...FEED_DEFAULTS, feedSize: 12 });
});

test('ignores_invalid_values', () => {
  const settings = resolveFeedSettings({
    feedSize: 0,
    minPaperShare: 2,
    quizQuestions: 'três',
    secondsPerCard: -5,
    unknown: 1,
  });

  expect(settings).toEqual(FEED_DEFAULTS);
});

test('defaults_match_pipeline_config', () => {
  expect(FEED_DEFAULTS).toEqual(pipelineOutput.settings);
});

test('estimates_reading_minutes', () => {
  expect(estimatedMinutes(FEED_DEFAULTS)).toBe(10);
  expect(estimatedMinutes({ ...FEED_DEFAULTS, feedSize: 7, secondsPerCard: 50 })).toBe(6);
});

test.each<[keyof typeof FEED_DEFAULTS, number, number]>([
  ['feedSize', 50, 51],
  ['publishIntervalHours', 168, 169],
  ['freshnessToleranceHours', 168, 169],
  ['quizQuestions', 10, 11],
  ['secondsPerCard', 600, 601],
])('%s accepts %d and falls back to the default above it', (key, limit, above) => {
  expect(resolveFeedSettings({ [key]: limit })[key]).toBe(limit);
  expect(resolveFeedSettings({ [key]: above })[key]).toBe(FEED_DEFAULTS[key]);
  expect(resolveFeedSettings({ [key]: 1e12 })[key]).toBe(FEED_DEFAULTS[key]);
});
