import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

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

/** Notificações locais via expo-notifications, sem servidor de push. */
export function createExpoNotificationScheduler(): NotificationScheduler {
  let channelReady = false;

  /**
   * Canal próprio do Android ("Lembrete diário" nas configurações do app); fora do Android a
   * chamada não faz nada. Se falhar (no Expo Go, falha com NullPointerException no código
   * nativo), as notificações usam o canal padrão do expo-notifications.
   */
  const ensureChannel = async () => {
    if (channelReady) return;
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Lembrete diário',
        importance: AndroidImportance.DEFAULT,
      });
      channelReady = true;
    } catch {
      channelReady = false;
    }
  };

  return {
    async requestPermission() {
      await ensureChannel(); // no Android 13+, o pedido só aparece depois que há um canal
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      return (await Notifications.requestPermissionsAsync()).granted;
    },
    async cancelAll() {
      await Notifications.cancelAllScheduledNotificationsAsync();
    },
    async schedule(at, message) {
      await ensureChannel();
      await Notifications.scheduleNotificationAsync({
        content: message,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          ...(channelReady && { channelId: CHANNEL_ID }),
        },
      });
    },
  };
}

export const expoNotificationScheduler = createExpoNotificationScheduler();
