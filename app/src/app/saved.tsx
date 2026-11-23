import { useRouter } from 'expo-router';

import { savedCardsRepository } from '@/dependencies';
import type { Card } from '@/features/content/contract';
import { SavedScreen } from '@/features/saved/SavedScreen';
import { AREA_NAMES } from '@/shared/config/areas';
import { useLoaded } from '@/shared/lib/useLoaded';

export default function SavedRoute() {
  const router = useRouter();
  const [items, setItems] = useLoaded(() => savedCardsRepository.list());

  const toggle = async (card: Card) => {
    await savedCardsRepository.toggle(card);
    setItems(await savedCardsRepository.list());
  };

  if (items === undefined) return null;
  return (
    <SavedScreen
      items={items}
      areaNames={AREA_NAMES}
      onToggleSave={(card) => void toggle(card)}
      onBack={() => router.back()}
    />
  );
}
