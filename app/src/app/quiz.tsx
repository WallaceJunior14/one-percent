import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { quizRepository } from '@/dependencies';
import type { TodaysQuiz } from '@/features/quiz/quizRepository';
import { QuizScreen } from '@/features/quiz/QuizScreen';
import { AREA_CATALOG } from '@/shared/config/areas';

const AREA_NAMES = Object.fromEntries(AREA_CATALOG.map((area) => [area.id, area.name]));

export default function QuizRoute() {
  const router = useRouter();
  const [quiz, setQuiz] = useState<TodaysQuiz | null | undefined>(undefined);

  useEffect(() => {
    void quizRepository.today().then(setQuiz);
  }, []);

  const unavailable = quiz === null || (quiz !== undefined && quiz.questions.length === 0);
  useEffect(() => {
    if (unavailable) router.back();
  }, [unavailable, router]);

  if (quiz === undefined || quiz === null || unavailable) return null;
  return (
    <QuizScreen
      questions={quiz.questions}
      areaNames={AREA_NAMES}
      onComplete={(score) => void quizRepository.recordScore(score)}
      onExit={() => router.back()}
    />
  );
}
