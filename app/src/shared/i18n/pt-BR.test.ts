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

it('formats_feed_counter', () => {
  expect(t.feed.seen(2, 15)).toBe('2 de 15 vistos');
});
