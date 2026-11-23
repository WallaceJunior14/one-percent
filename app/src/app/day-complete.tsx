import { useRouter } from 'expo-router';

import { progressRepository, quizRepository } from '@/dependencies';
import { calculateStreak } from '@/features/streak/calculateStreak';
import { DayCompleteScreen } from '@/features/streak/DayCompleteScreen';
import { AREA_NAMES } from '@/shared/config/areas';
import { systemClock, toLocalDateString } from '@/shared/lib/dates';
import { useLoadedOnFocus } from '@/shared/lib/useLoadedOnFocus';

async function loadDayComplete() {
  const [progress, quiz] = await Promise.all([progressRepository.load(), quizRepository.today()]);
  if (progress.lastDay === null) return null;
  return {
    summary: progress.lastDay,
    streak: calculateStreak(progress.completedDays, toLocalDateString(systemClock.now())),
    quiz:
      quiz && quiz.questions.length > 0
        ? { score: quiz.score, total: quiz.questions.length }
        : null,
  };
}

export default function DayCompleteRoute() {
  const router = useRouter();
  const [view] = useLoadedOnFocus(loadDayComplete);

  if (!view) return null;
  return (
    <DayCompleteScreen
      {...view}
      areaNames={AREA_NAMES}
      onStartQuiz={() => router.push('/quiz')}
      onReview={() => router.back()}
    />
  );
}
