import { fireEvent, render, screen } from '@testing-library/react-native';

import { Pill } from './Pill';

test('calls_on_press', async () => {
  const onPress = jest.fn();
  await render(<Pill label="Voltar" onPress={onPress} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));

  expect(onPress).toHaveBeenCalledTimes(1);
});

test('uses_the_accessibility_label_when_given', async () => {
  await render(<Pill label="Salvos" accessibilityLabel="Ver salvos" onPress={jest.fn()} />);

  expect(screen.getByRole('button', { name: 'Ver salvos' })).toBeOnTheScreen();
});

test('exposes_the_selected_state', async () => {
  await render(<Pill label="Todas" selected onPress={jest.fn()} />);

  expect(screen.getByRole('button', { name: 'Todas' })).toBeSelected();
});
