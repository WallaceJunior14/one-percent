import { plural, t } from './pt-BR';

const forms = { one: 'dia', other: 'dias' };

it('pluralizes_days_and_cards', () => {
  expect(plural(1, forms)).toBe('dia');
  expect(plural(2, forms)).toBe('dias');
  expect(plural(0, forms)).toBe('dias');
  expect(t.streak.days(1)).toBe('1 dia');
  expect(t.streak.days(3)).toBe('3 dias');
  expect(t.streak.current(1)).toBe('1 dia seguido');
  expect(t.streak.current(3)).toBe('3 dias seguidos');
  expect(t.reminder.body(15, 10)).toBe('Seu dia está pronto: 15 cards, ~10 min');
});

it('pluralizes_cards_and_questions_in_singular', () => {
  expect(t.profile.areaRow('Física', 1, 7)).toBe('Física: 1 card, 7%');
  expect(t.profile.areaRow('Física', 3, 7)).toBe('Física: 3 cards, 7%');
  expect(t.dayComplete.startQuiz(1)).toBe('Fazer o quiz (1 pergunta)');
  expect(t.dayComplete.startQuiz(5)).toBe('Fazer o quiz (5 perguntas)');
  expect(t.reminder.body(1, 2)).toBe('Seu dia está pronto: 1 card, ~2 min');
});

it('loads_without_intl_plural_rules', () => {
  const original = Intl.PluralRules;
  // O runtime do Android pode não ter `Intl.PluralRules`; o catálogo não pode depender dele.
  (Intl as { PluralRules?: unknown }).PluralRules = undefined;
  try {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const catalog = require('./pt-BR') as typeof import('./pt-BR');
      expect(catalog.t.streak.days(1)).toBe('1 dia');
      expect(catalog.t.streak.days(0)).toBe('0 dias');
    });
  } finally {
    Intl.PluralRules = original;
  }
});

it('formats_feed_counter', () => {
  expect(t.feed.seen(2, 15)).toBe('2 de 15 vistos');
});
