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
