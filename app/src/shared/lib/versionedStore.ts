import { type Clock, systemClock } from './dates';
import type { KeyValueStore } from './keyValueStore';

/** Converte os dados da versão `n` para a `n + 1`. */
export type Migration = (data: unknown) => unknown;

/** Para o passo em que os dados só ganharam o envelope, sem mudar de formato. */
export const sameFormat: Migration = (data) => data;

export type UnreadableData = { key: string; copiedTo: string; reason: string };

export type VersionedStoreOptions<T> = {
  store: KeyValueStore;
  key: string;
  /** Versão do formato gravado hoje. Valor sem envelope conta como versão 1. */
  version: number;
  schema: { parse(data: unknown): T };
  /** `migrations[n]` leva da versão `n` para a `n + 1`; precisa existir para cada passo. */
  migrations?: Record<number, Migration>;
  /** Chaves de versões anteriores do app, lidas só quando a chave atual não existe. */
  legacyKeys?: readonly string[];
  clock?: Clock;
  onUnreadable?(event: UnreadableData): void;
};

export type VersionedStore<T> = {
  /** `null` quando não há nada gravado ou o gravado não pôde ser lido (e foi preservado à parte). */
  read(): Promise<T | null>;
  write(value: T): Promise<void>;
};

type Envelope = { version: number; data: unknown };

function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === 2 &&
    keys.includes('data') &&
    Number.isInteger((value as { version?: unknown }).version)
  );
}

function decode(raw: string): Envelope {
  const parsed: unknown = JSON.parse(raw);
  return isEnvelope(parsed) ? parsed : { version: 1, data: parsed };
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Fora dos testes, o aviso no console é o registro do problema; nos testes, quem quiser
// observar passa `onUnreadable`.
function warnUnreadable(event: UnreadableData) {
  if (process.env.NODE_ENV === 'test') return;
  console.warn(
    `Dados locais ilegíveis em "${event.key}", copiados para "${event.copiedTo}"`,
    event,
  );
}

/**
 * Dados locais com versão de formato. Nada é apagado: antes de gravar um valor migrado, o
 * original fica em `<key>.backup.v<versão>`, e um valor ilegível é movido para
 * `<key>.unreadable.<timestamp>` para o app seguir com dados vazios sem perdê-lo.
 */
export function createVersionedStore<T>({
  store,
  key,
  version,
  schema,
  migrations = {},
  legacyKeys = [],
  clock = systemClock,
  onUnreadable = warnUnreadable,
}: VersionedStoreOptions<T>): VersionedStore<T> {
  const upgrade = ({ version: found, data }: Envelope): T => {
    if (found > version) {
      throw new Error(`versão ${found} é mais nova que a suportada (${version})`);
    }
    let current = data;
    for (let step = found; step < version; step += 1) {
      const migrate = migrations[step];
      if (!migrate) throw new Error(`sem migração da versão ${step}`);
      current = migrate(current);
    }
    return schema.parse(current);
  };

  const write = (value: T) => store.setItem(key, JSON.stringify({ version, data: value }));

  const preserve = async (source: string, raw: string, error: unknown) => {
    const copiedTo = `${key}.unreadable.${clock.now().getTime()}`;
    await store.setItem(copiedTo, raw);
    await store.removeItem(source);
    onUnreadable({ key, copiedTo, reason: reasonOf(error) });
  };

  const readFrom = async (source: string, raw: string): Promise<T | null> => {
    let stored: Envelope;
    let value: T;
    try {
      stored = decode(raw);
      value = upgrade(stored);
    } catch (error) {
      await preserve(source, raw, error);
      return null;
    }
    if (source !== key || stored.version !== version) {
      await store.setItem(`${key}.backup.v${stored.version}`, raw);
      await write(value);
      if (source !== key) await store.removeItem(source);
    }
    return value;
  };

  return {
    async read() {
      for (const source of [key, ...legacyKeys]) {
        const raw = await store.getItem(source);
        if (raw !== null) return readFrom(source, raw);
      }
      return null;
    },
    write,
  };
}
