import { fireEvent, render, screen } from '@testing-library/react-native';

import { DEFAULT_REMINDER, type ReminderSettings } from './reminderScheduler';
import { ReminderScreen } from './ReminderScreen';

async function setup({
  initial = DEFAULT_REMINDER as ReminderSettings,
  permissionDenied = false,
} = {}) {
  const onSave = jest.fn(async () => ({ permissionDenied }));
  await render(<ReminderScreen initial={initial} saveLabel="Começar" onSave={onSave} />);
  return { onSave };
}

const toggle = () => screen.getByRole('switch', { name: 'Lembrete diário' });

test('is_off_by_default_and_hides_times', async () => {
  await setup();

  expect(toggle()).not.toBeChecked();
  expect(screen.queryByRole('radio', { name: '07:00' })).toBeNull();
});

test('continuing_without_turning_on_keeps_it_off', async () => {
  const { onSave } = await setup();

  await fireEvent.press(screen.getByRole('button', { name: 'Começar' }));

  expect(onSave).toHaveBeenCalledWith({ enabled: false, hour: 8, minute: 0 });
});

test('saves_the_chosen_time', async () => {
  const { onSave } = await setup();

  await fireEvent.press(toggle());
  expect(screen.getByRole('radio', { name: '08:00' })).toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: '07:00' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Começar' }));

  expect(onSave).toHaveBeenCalledWith({ enabled: true, hour: 7, minute: 0 });
});

test('keeps_a_saved_time_outside_the_suggestions', async () => {
  await setup({ initial: { enabled: true, hour: 7, minute: 30 } });

  expect(screen.getByRole('radio', { name: '07:30' })).toBeChecked();
});

test('explains_when_permission_is_denied', async () => {
  await setup({ permissionDenied: true });

  await fireEvent.press(toggle());
  await fireEvent.press(screen.getByRole('button', { name: 'Começar' }));

  expect(await screen.findByText(/Sem permissão para notificações/)).toBeOnTheScreen();
  expect(toggle()).not.toBeChecked();
});
