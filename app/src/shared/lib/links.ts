import { Alert, Linking } from 'react-native';
import { t } from '@/shared/i18n/pt-BR';

const HTTPS = /^https:\/\/\S+$/i;

/**
 * Abre o link no navegador do celular, fora do app. Só aceita https: mesmo que o
 * contrato já garanta isso, um link `javascript:`/`file:`/`intent:` nunca chega ao sistema.
 */
export async function openExternalUrl(
  url: string,
  // Arrow function de propósito: `Linking.openURL` depende de `this` e falha se chamada solta.
  open: (url: string) => Promise<unknown> = (target) => Linking.openURL(target),
): Promise<boolean> {
  if (!HTTPS.test(url)) return false;
  try {
    await open(url);
    return true;
  } catch {
    return false;
  }
}

/** Abre o link e avisa a pessoa se não for possível, em vez de falhar em silêncio. */
export async function openUrlOrWarn(
  url: string,
  open?: (url: string) => Promise<unknown>,
  alert: (title: string, message: string) => void = (title, message) => Alert.alert(title, message),
): Promise<void> {
  if (!(await openExternalUrl(url, open))) {
    alert(t.links.openFailedTitle, t.links.openFailedMessage);
  }
}
