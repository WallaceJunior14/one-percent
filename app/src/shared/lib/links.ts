import { Linking } from 'react-native';

const HTTPS = /^https:\/\/\S+$/i;

/**
 * Abre o link no navegador do celular, fora do app (RF-010). Só aceita https: mesmo que o
 * contrato já garanta isso, um link `javascript:`/`file:`/`intent:` nunca chega ao sistema.
 */
export async function openExternalUrl(
  url: string,
  open: (url: string) => Promise<unknown> = Linking.openURL,
): Promise<boolean> {
  if (!HTTPS.test(url)) return false;
  try {
    await open(url);
    return true;
  } catch {
    return false;
  }
}
