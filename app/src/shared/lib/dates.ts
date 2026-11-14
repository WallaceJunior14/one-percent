export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

const SHORT_DATE = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });

/** Ex.: "31 de out.", no fuso do celular. */
export function formatShortDate(isoTimestamp: string): string {
  return SHORT_DATE.format(new Date(isoTimestamp));
}

/** Dia no fuso do celular, no formato do contrato (AAAA-MM-DD). */
export function toLocalDateString(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
