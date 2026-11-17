import * as Notifications from 'expo-notifications';

import { CHANNEL_ID, expoNotificationScheduler } from './expoNotificationScheduler';

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

beforeEach(() => jest.clearAllMocks());

test('does_not_ask_again_when_already_granted', async () => {
  mocked.getPermissionsAsync.mockResolvedValue({ granted: true } as never);

  expect(await expoNotificationScheduler.requestPermission()).toBe(true);
  expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
});

test('asks_for_permission_and_reports_denial', async () => {
  mocked.getPermissionsAsync.mockResolvedValue({ granted: false } as never);
  mocked.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);

  expect(await expoNotificationScheduler.requestPermission()).toBe(false);
  expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test('schedules_a_one_off_notification_on_the_reminder_channel', async () => {
  const at = new Date(2026, 10, 17, 7, 30);

  await expoNotificationScheduler.schedule(at, { title: 't', body: 'b' });

  expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
    content: { title: 't', body: 'b' },
    trigger: { type: 'date', date: at, channelId: CHANNEL_ID },
  });
});
