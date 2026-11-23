import { useRouter } from 'expo-router';

import { loadCatalog, preferencesRepository } from '@/dependencies';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import type { Preferences } from '@/features/onboarding/preferences';
import { useLoaded } from '@/shared/lib/useLoaded';

export default function OnboardingRoute() {
  const router = useRouter();
  const [loaded] = useLoaded(async () => ({
    initial: await preferencesRepository.load(),
    catalog: await loadCatalog(),
  }));

  if (loaded === undefined) return null;
  const { initial, catalog } = loaded;
  const isFirstTime = initial === null;

  const complete = async (preferences: Preferences) => {
    await preferencesRepository.save(preferences);
    if (isFirstTime) router.replace({ pathname: '/reminder', params: { first: '1' } });
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <OnboardingScreen initial={initial ?? undefined} catalog={catalog} onComplete={complete} />
  );
}
