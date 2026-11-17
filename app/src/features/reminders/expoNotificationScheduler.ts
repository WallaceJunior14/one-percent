import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationScheduler } from './reminderScheduler';

export const CHANNEL_ID = 'daily-reminder';

/** Mostra a notificação mesmo com o app aberto. Chamar uma vez, ao iniciar o app. */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Notificações locais via expo-notifications (sem servidor de push; ADR/plan H8). */
export const expoNotificationScheduler: NotificationScheduler = {
  async requestPermission() {
    // No Android 13+, o pedido de permissão só aparece depois que existe um canal.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Lembrete diário',
        importance: AndroidImportance.DEFAULT,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  },
  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
  async schedule(at, message) {
    await Notifications.scheduleNotificationAsync({
      content: message,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: CHANNEL_ID,
      },
    });
  },
};
