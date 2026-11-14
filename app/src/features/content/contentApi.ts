import { type DailyContent, parseDailyContent } from './contract';

export interface ContentApi {
  fetchLatest(): Promise<DailyContent>;
}

/** O mínimo de `fetch` que usamos; facilita testar sem polyfills. */
export type HttpResponse = { ok: boolean; status: number; json(): Promise<unknown> };
export type FetchFn = (url: string) => Promise<HttpResponse>;

/** Sem rede ou servidor com erro: situação esperada, tratada pelo app como estado, não como bug. */
export class ContentUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ContentUnavailableError';
  }
}

export function createHttpContentApi(baseUrl: string, fetchFn: FetchFn = fetch): ContentApi {
  const latestUrl = new URL('latest.json', baseUrl).toString();
  return {
    async fetchLatest() {
      let response: HttpResponse;
      try {
        response = await fetchFn(latestUrl);
      } catch (error) {
        throw new ContentUnavailableError('sem conexão com o servidor de conteúdo', {
          cause: error,
        });
      }
      if (!response.ok) {
        throw new ContentUnavailableError(`servidor de conteúdo respondeu HTTP ${response.status}`);
      }
      return parseDailyContent(await response.json());
    },
  };
}
