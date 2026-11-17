import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { progressRepository, quizRepository } from '@/dependencies';
import { calculateStreak } from '@/features/streak/calculateStreak';
import { ProfileScreen, quizAverage } from '@/features/streak/ProfileScreen';
import { AREA_CATALOG } from '@/shared/config/areas';
import { systemClock, toLocalDateString } from '@/shared/lib/dates';

const AREA_NAMES = Object.fromEntries(AREA_CATALOG.map((area) => [area.id, area.name]));

type View = Omit<Parameters<typeof ProfileScreen>[0], 'areaNames' | 'onBack'>;

export default function ProfileRoute() {
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([progressRepository.load(), quizRepository.history()]).then(
      ([progress, history]) => {
        if (cancelled) return;
        setView({
          streak: calculateStreak(progress.completedDays, toLocalDateString(systemClock.now())),
          totals: progress.totals,
          quizAveragePercent: quizAverage(history),
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (view === null) return null;
  return <ProfileScreen {...view} areaNames={AREA_NAMES} onBack={() => router.back()} />;
}
