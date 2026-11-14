import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { preferencesRepository } from '@/dependencies';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import type { Preferences } from '@/features/onboarding/preferences';

export default function OnboardingRoute() {
  const router = useRouter();
  const [initial, setInitial] = useState<Preferences | null | undefined>(undefined);

  useEffect(() => {
    void preferencesRepository.load().then(setInitial);
  }, []);

  if (initial === undefined) return null;

  const complete = async (preferences: Preferences) => {
    await preferencesRepository.save(preferences);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return <OnboardingScreen initial={initial ?? undefined} onComplete={complete} />;
}
