import appJson from '../../../app.json';
import { contentBaseUrlFrom } from './buildConfig';

test('reads_content_url_from_build_config', () => {
  expect(contentBaseUrlFrom({ contentBaseUrl: 'https://example.com/content/' })).toBe(
    'https://example.com/content/',
  );
});

test('fails_clearly_without_it', () => {
  expect(() => contentBaseUrlFrom(undefined)).toThrow(/contentBaseUrl/);
  expect(() => contentBaseUrlFrom({ contentBaseUrl: 'http://example.com/' })).toThrow(/https/);
});

test('app_json_defines_the_content_url', () => {
  expect(contentBaseUrlFrom(appJson.expo.extra)).toMatch(/^https:\/\//);
});

test('adds_the_trailing_slash_so_the_last_segment_is_kept', () => {
  expect(contentBaseUrlFrom({ contentBaseUrl: 'https://x.io/app' })).toBe('https://x.io/app/');
  expect(contentBaseUrlFrom({ contentBaseUrl: 'https://x.io/app/' })).toBe('https://x.io/app/');
});
