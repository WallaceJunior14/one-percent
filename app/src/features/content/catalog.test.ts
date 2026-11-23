import sampleDay from '../../../../contracts/examples/sample-day.json';
import { AREA_CATALOG, BUNDLED_GROUPS } from '@/shared/config/areas';
import { BUNDLED_CATALOG, catalogFrom } from './catalog';
import { parseDailyContent } from './contract';

const SAMPLE = parseDailyContent(sampleDay);
const ARTS = { id: 'arts', name: 'Artes', subareas: [{ id: 'arts.music', name: 'Música' }] };

test('uses_bundled_catalog_without_content', () => {
  expect(catalogFrom(null)).toEqual(BUNDLED_CATALOG);
  expect(BUNDLED_CATALOG.areas.map((area) => area.id)).toEqual(AREA_CATALOG.map((a) => a.id));
  expect(BUNDLED_CATALOG.groups).toEqual(BUNDLED_GROUPS);
});

test('uses_latest_published_catalog', () => {
  const content = {
    ...SAMPLE,
    groups: [...SAMPLE.groups!, { id: 'culture', name: 'Cultura' }],
    areas: [...SAMPLE.areas, { ...ARTS, groupId: 'culture', weight: 1 }],
  };

  const catalog = catalogFrom(content);

  expect(catalog.areas.at(-1)).toMatchObject({ id: 'arts', groupId: 'culture', weight: 1 });
  expect(catalog.groups.map((group) => group.id)).toContain('culture');
});

test('fills_missing_weight_and_group_from_the_bundled_catalog', () => {
  const content = {
    ...SAMPLE,
    groups: undefined,
    areas: SAMPLE.areas.map(({ weight: _w, groupId: _g, ...area }) => area),
  };

  expect(catalogFrom(content)).toEqual(BUNDLED_CATALOG);
});

test('unknown_area_without_weight_gets_weight_one_in_an_extra_group', () => {
  const catalog = catalogFrom({ ...SAMPLE, areas: [...SAMPLE.areas, ARTS] });

  expect(catalog.areas.find((area) => area.id === 'arts')).toMatchObject({
    weight: 1,
    groupId: 'other',
  });
  expect(catalog.groups.map((group) => group.id)).toContain('other');
});
