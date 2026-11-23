export type FeedSettings = {
  feedSize: number;
  minPaperShare: number;
  quizQuestions: number;
  publishIntervalHours: number;
  freshnessToleranceHours: number;
  secondsPerCard: number;
};

/** Usados quando o conteúdo não traz o parâmetro, ou traz um valor inválido. */
export const FEED_DEFAULTS: FeedSettings = {
  feedSize: 15,
  minPaperShare: 0.3,
  quizQuestions: 3,
  publishIntervalHours: 24,
  freshnessToleranceHours: 6,
  secondsPerCard: 40,
};

const isPositiveInt = (value: number) => Number.isInteger(value) && value > 0;
const isNonNegativeInt = (value: number) => Number.isInteger(value) && value >= 0;

const IS_VALID: Record<keyof FeedSettings, (value: number) => boolean> = {
  feedSize: isPositiveInt,
  minPaperShare: (value) => value >= 0 && value <= 1,
  quizQuestions: isNonNegativeInt,
  publishIntervalHours: (value) => value > 0,
  freshnessToleranceHours: (value) => value >= 0,
  secondsPerCard: (value) => value > 0,
};

/** Parâmetros publicados no conteúdo, cada um validado e trocado pelo padrão se inválido. */
export function resolveFeedSettings(published: Record<string, unknown> | undefined): FeedSettings {
  const settings = { ...FEED_DEFAULTS };
  for (const key of Object.keys(IS_VALID) as (keyof FeedSettings)[]) {
    const value = published?.[key];
    if (typeof value === 'number' && Number.isFinite(value) && IS_VALID[key](value)) {
      settings[key] = value;
    }
  }
  return settings;
}

export function estimatedMinutes(settings: FeedSettings): number {
  return Math.ceil((settings.feedSize * settings.secondsPerCard) / 60);
}
