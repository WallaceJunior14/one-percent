import { openExternalUrl } from './links';

test('opens_https_url_in_the_browser', async () => {
  const open = jest.fn(async () => undefined);

  expect(await openExternalUrl('https://example.com/a', open)).toBe(true);
  expect(open).toHaveBeenCalledWith('https://example.com/a');
});

test.each(['http://example.com', 'javascript:alert(1)', 'file:///etc/passwd', 'intent://x'])(
  'blocks_non_https_url %s',
  async (url) => {
    const open = jest.fn(async () => undefined);

    expect(await openExternalUrl(url, open)).toBe(false);
    expect(open).not.toHaveBeenCalled();
  },
);

test('returns_false_when_the_browser_fails', async () => {
  const open = jest.fn(async () => {
    throw new Error('no activity');
  });

  expect(await openExternalUrl('https://example.com', open)).toBe(false);
});
