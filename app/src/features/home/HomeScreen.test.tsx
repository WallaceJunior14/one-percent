import { render, screen } from '@testing-library/react-native';

import { HomeScreen } from './HomeScreen';

test('shows_app_name', async () => {
  await render(<HomeScreen />);

  expect(screen.getByText('1% ao Dia')).toBeOnTheScreen();
});
