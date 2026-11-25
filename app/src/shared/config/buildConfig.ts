const HTTPS = /^https:\/\/\S+$/;

/** Endereço do conteúdo publicado, definido por build em `expo.extra.contentBaseUrl`. */
export function contentBaseUrlFrom(extra: unknown): string {
  const value =
    typeof extra === 'object' && extra !== null
      ? (extra as Record<string, unknown>).contentBaseUrl
      : undefined;
  if (typeof value !== 'string') {
    throw new Error('expo.extra.contentBaseUrl ausente no app.json');
  }
  if (!HTTPS.test(value)) {
    throw new Error(`expo.extra.contentBaseUrl precisa ser https: ${value}`);
  }
  // Sem a barra final, `new URL('latest.json', base)` descartaria o último segmento do caminho.
  return value.endsWith('/') ? value : `${value}/`;
}
