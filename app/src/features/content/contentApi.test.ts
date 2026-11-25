import sampleDay from '../../../../contracts/examples/sample-day.json';
import { ContentUnavailableError, createHttpContentApi, type HttpResponse } from './contentApi';
import { ContractViolationError } from './contract';

const BASE_URL = 'https://example.com/one-percent/';

function respondText(text: string, status = 200): HttpResponse {
  return { ok: status >= 200 && status < 300, status, text: async () => text };
}

function respond(body: unknown, status = 200): HttpResponse {
  return respondText(JSON.stringify(body), status);
}

test('fetches_latest_json_from_base_url', async () => {
  const fetchFn = jest.fn(async () => respond(sampleDay));

  await createHttpContentApi(BASE_URL, fetchFn).fetchLatest();

  expect(fetchFn).toHaveBeenCalledWith('https://example.com/one-percent/latest.json');
});

test('returns_parsed_content', async () => {
  const content = await createHttpContentApi(BASE_URL, async () =>
    respond(sampleDay),
  ).fetchLatest();

  expect(content.date).toBe('2026-11-01');
  expect(content.cards).toHaveLength(22);
});

test('http_error_raises_content_unavailable', async () => {
  const api = createHttpContentApi(BASE_URL, async () => respond(null, 503));

  await expect(api.fetchLatest()).rejects.toThrow(ContentUnavailableError);
});

test('network_failure_raises_content_unavailable', async () => {
  const api = createHttpContentApi(BASE_URL, async () => {
    throw new TypeError('Network request failed');
  });

  await expect(api.fetchLatest()).rejects.toThrow(ContentUnavailableError);
});

test('invalid_payload_raises_contract_violation', async () => {
  const api = createHttpContentApi(BASE_URL, async () => respond({ hello: 'world' }));

  await expect(api.fetchLatest()).rejects.toThrow(ContractViolationError);
});

test('oversized_response_raises_content_unavailable_without_parsing', async () => {
  const parse = jest.spyOn(JSON, 'parse');
  const api = createHttpContentApi(BASE_URL, async () =>
    respondText(' '.repeat(2 * 1024 * 1024 + 1)),
  );

  await expect(api.fetchLatest()).rejects.toThrow(ContentUnavailableError);
  expect(parse).not.toHaveBeenCalled();
  parse.mockRestore();
});
