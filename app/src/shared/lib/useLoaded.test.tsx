import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useLoaded } from './useLoaded';

test('starts_undefined_and_resolves_the_value', async () => {
  const { result } = await renderHook(() => useLoaded(async () => 42));

  await waitFor(() => expect(result.current[0]).toBe(42));
});

test('loads_only_once_even_if_the_loader_changes', async () => {
  const load = jest.fn(async () => 'ok');
  const { result, rerender } = await renderHook(() => useLoaded(() => load()));

  await waitFor(() => expect(result.current[0]).toBe('ok'));
  await rerender({});

  expect(load).toHaveBeenCalledTimes(1);
});

test('setter_replaces_the_value', async () => {
  const { result } = await renderHook(() => useLoaded(async () => 1));
  await waitFor(() => expect(result.current[0]).toBe(1));

  await act(async () => result.current[1](2));

  expect(result.current[0]).toBe(2);
});
