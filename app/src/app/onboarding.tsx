import { useRouter } from 'expo-router';

import { preferencesRepository } from '@/dependencies';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import type { Preferences } from '@/features/onboarding/preferences';
import { useLoaded } from '@/shared/lib/useLoaded';

export default function OnboardingRoute() {
  const router = useRouter();
  const [initial] = useLoaded(() => preferencesRepository.load());

  if (initial === undefined) return null;
  const isFirstTime = initial === null;

  const complete = async (preferences: Preferences) => {
    await preferencesRepository.save(preferences);
    if (isFirstTime) router.replace({ pathname: '/reminder', params: { first: '1' } });
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return <OnboardingScreen initial={initial ?? undefined} onComplete={complete} />;
}
