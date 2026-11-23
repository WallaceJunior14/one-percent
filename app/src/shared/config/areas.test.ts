import sampleDay from '../../../../contracts/examples/sample-day.json';
import { AREA_CATALOG, BUNDLED_GROUPS } from './areas';

test('bundled_catalog_matches_contract_sample', () => {
  expect(AREA_CATALOG).toEqual(sampleDay.areas);
  expect(BUNDLED_GROUPS).toEqual(sampleDay.groups);
});

test('every_area_belongs_to_a_bundled_group', () => {
  const groupIds = new Set(BUNDLED_GROUPS.map((group) => group.id));

  expect(AREA_CATALOG.every((area) => area.groupId && groupIds.has(area.groupId))).toBe(true);
});
