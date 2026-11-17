import { render } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import sampleDay from '../../../../contracts/examples/sample-day.json';
import { parseDailyContent } from '@/features/content/contract';
import { CardPreview } from './CardPreview';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const cards = parseDailyContent(sampleDay).cards;
const news = cards.find((c) => c.id === 'c_000000000001')!;
const paper = cards.find((c) => c.id === 'c_000000000003')!;

// Snapshots dos cards nos dois temas (T112): mudanças de cor ou layout aparecem no review.
describe.each(['light', 'dark'] as const)('%s theme', (name) => {
  beforeEach(() => jest.mocked(useColorScheme).mockReturnValue(name));

  test.each([
    ['news', news],
    ['paper', paper],
  ])('%s_card_snapshot', async (_, card) => {
    const view = await render(<CardPreview card={card} areaName="Tecnologia" onOpen={jest.fn()} />);
    expect(view.toJSON()).toMatchSnapshot();
  });
});
