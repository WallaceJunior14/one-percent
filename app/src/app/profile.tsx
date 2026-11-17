import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { progressRepository, quizRepository, reminderService } from '@/dependencies';
import { calculateStreak } from '@/features/streak/calculateStreak';
import { ProfileScreen, quizAverage } from '@/features/streak/ProfileScreen';
import { AREA_CATALOG } from '@/shared/config/areas';
import { systemClock, toLocalDateString } from '@/shared/lib/dates';

const AREA_NAMES = Object.fromEntries(AREA_CATALOG.map((area) => [area.id, area.name]));

type View = Omit<Parameters<typeof ProfileScreen>[0], 'areaNames' | 'onBack' | 'onEditReminder'>;

export default function ProfileRoute() {
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);

  // Recarrega ao voltar da tela de lembrete.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([
        progressRepository.load(),
        quizRepository.history(),
        reminderService.settings(),
      ]).then(([progress, history, reminder]) => {
        if (cancelled) return;
        setView({
          streak: calculateStreak(progress.completedDays, toLocalDateString(systemClock.now())),
          totals: progress.totals,
          quizAveragePercent: quizAverage(history),
          reminder,
        });
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (view === null) return null;
  return (
    <ProfileScreen
      {...view}
      areaNames={AREA_NAMES}
      onBack={() => router.back()}
      onEditReminder={() => router.push('/reminder')}
    />
  );
}
