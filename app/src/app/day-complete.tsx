import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { progressRepository, quizRepository } from '@/dependencies';
import { calculateStreak, type Streak } from '@/features/streak/calculateStreak';
import { DayCompleteScreen } from '@/features/streak/DayCompleteScreen';
import type { DaySummary } from '@/features/streak/progress';
import { AREA_CATALOG } from '@/shared/config/areas';
import { systemClock, toLocalDateString } from '@/shared/lib/dates';

const AREA_NAMES = Object.fromEntries(AREA_CATALOG.map((area) => [area.id, area.name]));

type View = {
  summary: DaySummary;
  streak: Streak;
  quiz: { score: number | null; total: number } | null;
};

export default function DayCompleteRoute() {
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);

  // Recarrega ao voltar do quiz, para mostrar a pontuação.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([progressRepository.load(), quizRepository.today()]).then(
        ([progress, quiz]) => {
          if (cancelled || progress.lastDay === null) return;
          setView({
            summary: progress.lastDay,
            streak: calculateStreak(progress.completedDays, toLocalDateString(systemClock.now())),
            quiz:
              quiz && quiz.questions.length > 0
                ? { score: quiz.score, total: quiz.questions.length }
                : null,
          });
        },
      );
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (view === null) return null;
  return (
    <DayCompleteScreen
      summary={view.summary}
      streak={view.streak}
      areaNames={AREA_NAMES}
      quiz={view.quiz}
      onStartQuiz={() => router.push('/quiz')}
      onReview={() => router.back()}
    />
  );
}
