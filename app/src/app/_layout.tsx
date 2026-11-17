import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { configureNotificationHandler } from '@/features/reminders/expoNotificationScheduler';

configureNotificationHandler();

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}
