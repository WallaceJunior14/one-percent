import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { progressRepository } from '@/dependencies';
import { calculateStreak, type Streak } from '@/features/streak/calculateStreak';
import { DayCompleteScreen } from '@/features/streak/DayCompleteScreen';
import type { DaySummary } from '@/features/streak/progress';
import { AREA_CATALOG } from '@/shared/config/areas';
import { systemClock, toLocalDateString } from '@/shared/lib/dates';

const AREA_NAMES = Object.fromEntries(AREA_CATALOG.map((area) => [area.id, area.name]));

export default function DayCompleteRoute() {
  const router = useRouter();
  const [view, setView] = useState<{ summary: DaySummary; streak: Streak } | null>(null);

  useEffect(() => {
    void progressRepository.load().then((progress) => {
      if (progress.lastDay === null) return;
      const today = toLocalDateString(systemClock.now());
      setView({
        summary: progress.lastDay,
        streak: calculateStreak(progress.completedDays, today),
      });
    });
  }, []);

  if (view === null) return null;
  return (
    <DayCompleteScreen
      summary={view.summary}
      streak={view.streak}
      areaNames={AREA_NAMES}
      onReview={() => router.back()}
    />
  );
}
