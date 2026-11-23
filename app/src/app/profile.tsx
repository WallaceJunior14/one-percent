import { useRouter } from 'expo-router';

import { progressRepository, quizRepository, reminderService } from '@/dependencies';
import { quizAverage } from '@/features/quiz/quizStats';
import { calculateStreak } from '@/features/streak/calculateStreak';
import { ProfileScreen } from '@/features/streak/ProfileScreen';
import { AREA_NAMES } from '@/shared/config/areas';
import { systemClock, toLocalDateString } from '@/shared/lib/dates';
import { useLoadedOnFocus } from '@/shared/lib/useLoadedOnFocus';

async function loadProfile() {
  const [progress, history, reminder] = await Promise.all([
    progressRepository.load(),
    quizRepository.history(),
    reminderService.settings(),
  ]);
  return {
    streak: calculateStreak(progress.completedDays, toLocalDateString(systemClock.now())),
    totals: progress.totals,
    quizAveragePercent: quizAverage(history),
    reminder,
  };
}

export default function ProfileRoute() {
  const router = useRouter();
  const [profile] = useLoadedOnFocus(loadProfile);

  if (profile === undefined) return null;
  return (
    <ProfileScreen
      {...profile}
      areaNames={AREA_NAMES}
      onBack={() => router.back()}
      onEditReminder={() => router.push('/reminder')}
    />
  );
}
