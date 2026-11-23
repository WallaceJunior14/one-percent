import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { type Loaded, subscribeToLoad } from './useLoaded';

/** Como `useLoaded`, mas recarrega sempre que a tela volta ao foco. */
export function useLoadedOnFocus<T>(load: () => Promise<T>): Loaded<T> {
  const [initialLoad] = useState(() => load);
  const [value, setValue] = useState<T>();
  useFocusEffect(useCallback(() => subscribeToLoad(initialLoad, setValue), [initialLoad]));
  return [value, setValue];
}
