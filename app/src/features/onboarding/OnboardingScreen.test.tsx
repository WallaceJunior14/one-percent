import { fireEvent, render, screen } from '@testing-library/react-native';

import { OnboardingScreen } from './OnboardingScreen';

async function setup(initial?: { areaIds: string[]; subareaIds: string[] }) {
  const onComplete = jest.fn();
  await render(<OnboardingScreen initial={initial} onComplete={onComplete} />);
  return { onComplete };
}

const continueButton = () => screen.getByRole('button', { name: 'Continuar' });

test('groups_areas_under_group_headers', async () => {
  await setup();

  expect(screen.getByRole('header', { name: 'Ciência & Tecnologia' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Mercado & Saúde' })).toBeOnTheScreen();
  expect(screen.getByRole('checkbox', { name: 'Tecnologia' })).toBeOnTheScreen();
  expect(screen.getByRole('checkbox', { name: 'Saúde' })).toBeOnTheScreen();
});

test('continue_disabled_until_area_selected', async () => {
  await setup();

  expect(continueButton()).toBeDisabled();

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Tecnologia' }));

  expect(continueButton()).toBeEnabled();
  expect(screen.getByRole('checkbox', { name: 'Tecnologia' })).toBeChecked();
});

test('saves_selection', async () => {
  const { onComplete } = await setup();

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Tecnologia' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Saúde' }));
  await fireEvent.press(continueButton());

  expect(onComplete).toHaveBeenCalledWith({ areaIds: ['tech', 'health'], subareaIds: [] });
});

test('shows_subareas_only_for_selected_areas_and_saves_them', async () => {
  const { onComplete } = await setup();

  expect(screen.queryByRole('checkbox', { name: 'Saúde mental' })).toBeNull();

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Saúde' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Saúde mental' }));
  await fireEvent.press(continueButton());

  expect(onComplete).toHaveBeenCalledWith({
    areaIds: ['health'],
    subareaIds: ['health.mental'],
  });
});

test('unselecting_area_also_drops_its_subareas', async () => {
  const { onComplete } = await setup();

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Tecnologia' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'IA' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Ciência' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Tecnologia' }));
  await fireEvent.press(continueButton());

  expect(onComplete).toHaveBeenCalledWith({ areaIds: ['science'], subareaIds: [] });
});

test('starts_from_previous_choices_when_editing', async () => {
  await setup({ areaIds: ['finance'], subareaIds: ['finance.personal'] });

  expect(screen.getByRole('checkbox', { name: 'Finanças' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Finanças pessoais' })).toBeChecked();
  expect(continueButton()).toBeEnabled();
});
