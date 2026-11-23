import { useEffect, useState } from 'react';

export type Loaded<T> = [value: T | undefined, setValue: (value: T) => void];

/** Roda `load` e entrega o resultado, a menos que a tela tenha saído antes. */
export function subscribeToLoad<T>(load: () => Promise<T>, setValue: (value: T) => void) {
  let cancelled = false;
  void load().then((value) => {
    if (!cancelled) setValue(value);
  });
  return () => {
    cancelled = true;
  };
}

/** Carrega um valor ao montar a tela; `undefined` enquanto carrega. Usa o primeiro `load`. */
export function useLoaded<T>(load: () => Promise<T>): Loaded<T> {
  const [initialLoad] = useState(() => load);
  const [value, setValue] = useState<T>();
  useEffect(() => subscribeToLoad(initialLoad, setValue), [initialLoad]);
  return [value, setValue];
}
