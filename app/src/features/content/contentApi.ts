import { type ContentDiagnostics, type DailyContent, parseDailyContent } from './contract';

/** `diagnostics` vem da leitura do payload; o que não passou pela leitura não o tem. */
export type FetchedContent = DailyContent & { diagnostics?: ContentDiagnostics };

export interface ContentApi {
  fetchLatest(): Promise<FetchedContent>;
}

/** O mínimo de `fetch` que usamos; facilita testar sem polyfills. */
export type HttpResponse = { ok: boolean; status: number; text(): Promise<string> };

/** Um dia real tem dezenas de KB; o teto protege a memória e o limite do armazenamento local. */
const MAX_RESPONSE_CHARS = 2 * 1024 * 1024;
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
      const body = await response.text();
      if (body.length > MAX_RESPONSE_CHARS) {
        throw new ContentUnavailableError('resposta do servidor de conteúdo grande demais');
      }
      return parseDailyContent(JSON.parse(body));
    },
  };
}
