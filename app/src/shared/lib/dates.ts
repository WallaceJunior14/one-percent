export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Dia no fuso do celular, no formato do contrato (AAAA-MM-DD). */
export function toLocalDateString(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
