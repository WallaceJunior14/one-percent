import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { quizRepository } from '@/dependencies';
import { QuizScreen } from '@/features/quiz/QuizScreen';
import { AREA_NAMES } from '@/shared/config/areas';
import { useLoaded } from '@/shared/lib/useLoaded';

export default function QuizRoute() {
  const router = useRouter();
  const [quiz] = useLoaded(() => quizRepository.today());

  const unavailable = quiz === null || (quiz !== undefined && quiz.questions.length === 0);
  useEffect(() => {
    if (unavailable) router.back();
  }, [unavailable, router]);

  if (!quiz || unavailable) return null;
  return (
    <QuizScreen
      questions={quiz.questions}
      areaNames={AREA_NAMES}
      onComplete={(score) => void quizRepository.recordScore(score)}
      onExit={() => router.back()}
    />
  );
}
