import { fireEvent, render, screen } from '@testing-library/react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { type Card, parseDailyContent } from '@/features/content/contract';
import { QuizScreen } from './QuizScreen';

const content = parseDailyContent(sampleDay);
const areaNames = Object.fromEntries(content.areas.map((area) => [area.id, area.name]));
const questions = content.cards.slice(0, 3);

const correctOf = (card: Card) => card.quiz.options[card.quiz.answerIndex];
const wrongOf = (card: Card) => card.quiz.options.find((_, i) => i !== card.quiz.answerIndex)!;
const option = (text: string) => screen.getByRole('button', { name: `Alternativa: ${text}` });

async function setup() {
  const callbacks = { onComplete: jest.fn(), onExit: jest.fn() };
  await render(<QuizScreen questions={questions} areaNames={areaNames} {...callbacks} />);
  return callbacks;
}

test('shows_first_question_with_four_options', async () => {
  await setup();

  expect(screen.getByText('Pergunta 1 de 3')).toBeOnTheScreen();
  expect(screen.getByText(questions[0].quiz.question)).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: /^Alternativa:/ })).toHaveLength(4);
});

test('reveals_the_correct_answer_after_a_wrong_choice', async () => {
  await setup();

  await fireEvent.press(option(wrongOf(questions[0])));

  expect(screen.getByText('Não foi dessa vez')).toBeOnTheScreen();
  expect(screen.getByText(`Resposta certa: ${correctOf(questions[0])}`)).toBeOnTheScreen();
});

test('celebrates_a_correct_choice', async () => {
  await setup();

  await fireEvent.press(option(correctOf(questions[0])));

  expect(screen.getByText('Acertou!')).toBeOnTheScreen();
});

test('answer_cannot_be_changed', async () => {
  await setup();

  await fireEvent.press(option(wrongOf(questions[0])));

  expect(option(correctOf(questions[0]))).toBeDisabled();
});

test('shortcut_opens_the_source_card', async () => {
  await setup();
  await fireEvent.press(option(correctOf(questions[0])));

  await fireEvent.press(screen.getByRole('button', { name: 'Ver o card de origem' }));

  expect(screen.getByText(questions[0].whyItMatters)).toBeOnTheScreen();
});

test('scores_and_reports_at_the_end', async () => {
  const { onComplete, onExit } = await setup();

  await fireEvent.press(option(correctOf(questions[0])));
  await fireEvent.press(screen.getByRole('button', { name: 'Próxima pergunta' }));
  await fireEvent.press(option(wrongOf(questions[1])));
  await fireEvent.press(screen.getByRole('button', { name: 'Próxima pergunta' }));
  await fireEvent.press(option(correctOf(questions[2])));
  await fireEvent.press(screen.getByRole('button', { name: 'Ver resultado' }));

  expect(onComplete).toHaveBeenCalledWith(2);
  expect(screen.getByText('Você acertou 2 de 3')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
  expect(onExit).toHaveBeenCalledTimes(1);
});
