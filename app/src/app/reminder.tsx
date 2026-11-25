import { useLocalSearchParams, useRouter } from 'expo-router';

import { reminderService } from '@/dependencies';
import type { ReminderSettings } from '@/features/reminders/reminderScheduler';
import { ReminderScreen } from '@/features/reminders/ReminderScreen';
import { t } from '@/shared/i18n/pt-BR';
import { useLoaded } from '@/shared/lib/useLoaded';

export default function ReminderRoute() {
  const router = useRouter();
  const { first } = useLocalSearchParams<{ first?: string }>();
  const fromOnboarding = first === '1';
  const [initial] = useLoaded(() => reminderService.settings());

  if (initial === undefined) return null;

  const save = async (settings: ReminderSettings) => {
    const result = await reminderService.update(settings);
    if (result.status === 'saved') {
      if (fromOnboarding) router.replace('/');
      else router.back();
    }
    return result;
  };

  return (
    <ReminderScreen
      initial={initial}
      saveLabel={fromOnboarding ? t.reminder.start : t.common.save}
      onSave={save}
      onBack={fromOnboarding ? undefined : () => router.back()}
    />
  );
}
