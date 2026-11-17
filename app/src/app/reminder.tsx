import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { reminderService } from '@/dependencies';
import { type ReminderSettings } from '@/features/reminders/reminderScheduler';
import { ReminderScreen } from '@/features/reminders/ReminderScreen';

export default function ReminderRoute() {
  const router = useRouter();
  const { first } = useLocalSearchParams<{ first?: string }>();
  const fromOnboarding = first === '1';
  const [initial, setInitial] = useState<ReminderSettings | null>(null);

  useEffect(() => {
    void reminderService.settings().then(setInitial);
  }, []);

  if (initial === null) return null;

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
      saveLabel={fromOnboarding ? 'Começar' : 'Salvar'}
      onSave={save}
      onBack={fromOnboarding ? undefined : () => router.back()}
    />
  );
}
