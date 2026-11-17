import * as Notifications from 'expo-notifications';

import { CHANNEL_ID, createExpoNotificationScheduler } from './expoNotificationScheduler';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
}));

const mocked = jest.mocked(Notifications);
const AT = new Date(2026, 10, 17, 7, 30);

beforeEach(() => {
  jest.clearAllMocks();
  mocked.setNotificationChannelAsync.mockResolvedValue(null);
  mocked.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
});

test('does_not_ask_again_when_already_granted', async () => {
  expect(await createExpoNotificationScheduler().requestPermission()).toBe(true);
  expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
});

test('asks_for_permission_and_reports_denial', async () => {
  mocked.getPermissionsAsync.mockResolvedValue({ granted: false } as never);
  mocked.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);

  expect(await createExpoNotificationScheduler().requestPermission()).toBe(false);
  expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test('schedules_a_one_off_notification_on_the_reminder_channel', async () => {
  const scheduler = createExpoNotificationScheduler();

  await scheduler.schedule(AT, { title: 't', body: 'b' });

  expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
    content: { title: 't', body: 'b' },
    trigger: { type: 'date', date: AT, channelId: CHANNEL_ID },
  });
});

// No Expo Go, criar o canal falhou com NullPointerException no código nativo.
test('falls_back_to_the_default_channel_when_creating_ours_fails', async () => {
  mocked.setNotificationChannelAsync.mockRejectedValue(new Error('NullPointerException'));
  const scheduler = createExpoNotificationScheduler();

  expect(await scheduler.requestPermission()).toBe(true);
  await scheduler.schedule(AT, { title: 't', body: 'b' });

  expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
    content: { title: 't', body: 'b' },
    trigger: { type: 'date', date: AT },
  });
});
