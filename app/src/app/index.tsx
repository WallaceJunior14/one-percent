import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { appDependencies } from '@/dependencies';
import { DailyFeed } from '@/features/feed/DailyFeed';

export default function FeedRoute() {
  const router = useRouter();
  // Recarrega ao voltar para esta tela (ex.: depois de editar as áreas).
  const [reloadKey, setReloadKey] = useState(0);
  useFocusEffect(useCallback(() => setReloadKey((key) => key + 1), []));

  return (
    <DailyFeed
      key={reloadKey}
      deps={appDependencies}
      onNeedOnboarding={() => router.replace('/onboarding')}
      onEditAreas={() => router.push('/onboarding')}
      onOpenSaved={() => router.push('/saved')}
      onOpenProfile={() => router.push('/profile')}
      onFinished={() => router.push('/day-complete')}
    />
  );
}
