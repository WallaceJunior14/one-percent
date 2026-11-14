import sampleDay from '../../../../contracts/examples/sample-day.json';
import { AREA_GROUPS } from './areaGroups';
import { AREA_CATALOG } from './areas';

test('catalog_matches_contract_sample_areas', () => {
  expect(AREA_CATALOG).toEqual(sampleDay.areas);
});

test('every_area_belongs_to_exactly_one_group', () => {
  const grouped = AREA_GROUPS.flatMap((group) => group.areaIds);

  expect([...grouped].sort()).toEqual(AREA_CATALOG.map((area) => area.id).sort());
});
