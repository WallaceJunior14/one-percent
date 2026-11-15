import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { savedCardsRepository } from '@/dependencies';
import type { Card } from '@/features/content/contract';
import type { SavedCard } from '@/features/saved/savedCards';
import { SavedScreen } from '@/features/saved/SavedScreen';
import { AREA_CATALOG } from '@/shared/config/areas';

const AREA_NAMES = Object.fromEntries(AREA_CATALOG.map((area) => [area.id, area.name]));

export default function SavedRoute() {
  const router = useRouter();
  const [items, setItems] = useState<SavedCard[] | null>(null);

  useEffect(() => {
    void savedCardsRepository.list().then(setItems);
  }, []);

  const toggle = async (card: Card) => {
    await savedCardsRepository.toggle(card);
    setItems(await savedCardsRepository.list());
  };

  if (items === null) return null;
  return (
    <SavedScreen
      items={items}
      areaNames={AREA_NAMES}
      onToggleSave={(card) => void toggle(card)}
      onBack={() => router.back()}
    />
  );
}
