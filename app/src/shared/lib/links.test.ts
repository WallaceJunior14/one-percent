import { Linking } from 'react-native';

import { openExternalUrl, openUrlOrWarn } from './links';

test('default_opener_keeps_linking_bound', async () => {
  // No app real, Linking.openURL usa `this`; chamada "solta" lança erro (bug do 1º teste no celular).
  const openURL = jest.spyOn(Linking, 'openURL').mockImplementation(function (this: unknown) {
    if (this !== Linking) throw new TypeError("Cannot read property '_validateURL' of undefined");
    return Promise.resolve();
  });

  expect(await openExternalUrl('https://example.com/a')).toBe(true);
  expect(openURL).toHaveBeenCalledWith('https://example.com/a');
  openURL.mockRestore();
});

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

test('open_or_warn_alerts_when_link_cannot_open', async () => {
  const alert = jest.fn();

  await openUrlOrWarn('http://inseguro.example', jest.fn(), alert);

  expect(alert).toHaveBeenCalledWith('Não foi possível abrir o link', expect.any(String));
});

test('open_or_warn_stays_quiet_on_success', async () => {
  const alert = jest.fn();

  await openUrlOrWarn(
    'https://example.com',
    jest.fn(async () => undefined),
    alert,
  );

  expect(alert).not.toHaveBeenCalled();
});

test('returns_false_when_the_browser_fails', async () => {
  const open = jest.fn(async () => {
    throw new Error('no activity');
  });

  expect(await openExternalUrl('https://example.com', open)).toBe(false);
});
