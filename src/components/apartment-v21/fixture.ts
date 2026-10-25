import { createFixedApartment } from '@/construction/migration';
import type { BuildingFurniture, BuildingPlan } from '@/construction/types';
import { FURNITURE } from '@/domain/catalog';
import { APARTMENT_ASSETS, getApartmentFootprint, type ApartmentAssetId } from './asset-registry';

const CATALOG_IDS: Record<ApartmentAssetId, string> = {
  bed: 'cloud-bed', wardrobe: 'wardrobe', desk: 'workstation', chair: 'dining-chair',
  sofa: 'corner-sofa', kitchen: 'kitchen-island', stool: 'bar-stool',
  bathroom: 'bathroom-suite', plant: 'biolume-plant', coffee: 'coffee-table',
  lamp: 'neon-floor-lamp', rug: 'wool-rug',
};

/** Converts authored metre-space centres to Home's saved footprint convention. */
function fixtureItem(asset: ApartmentAssetId, suffix = '', center?: [number, number], rotation?: BuildingFurniture['rotation']): BuildingFurniture {
  const spec = APARTMENT_ASSETS[asset];
  const furnitureId = CATALOG_IDS[asset];
  const angle = rotation ?? ('rotation' in spec ? Math.round(spec.rotation * 180 / Math.PI) as BuildingFurniture['rotation'] : 0);
  const rotated = angle % 180 !== 0;
  const definition = FURNITURE.find(item => item.id === furnitureId);
  const footprint = definition ? undefined : getApartmentFootprint(furnitureId, angle);
  const width = definition ? Math.ceil(rotated ? definition.depth : definition.width) : footprint?.width ?? 1;
  const depth = definition ? Math.ceil(rotated ? definition.width : definition.depth) : footprint?.depth ?? 1;
  return { id: `v21-fixture:${asset}${suffix}`, furnitureId, x: (center?.[0] ?? spec.position[0]) - width / 2,
    z: (center?.[1] ?? spec.position[2]) - depth / 2, level: 0, rotation: angle };
}

/** Render-only state. Never send this fixture to a save, ownership or grant API. */
export function createApartmentFixture(starter = false): BuildingPlan {
  const plan = createFixedApartment('2026-01-01T00:00:00.000Z').plan;
  plan.floors = plan.floors.map(cell => ({ ...cell, materialId: !starter && cell.x >= 3 && cell.z >= 2 ? 'floor-ceramic' : 'floor-wood' }));
  plan.furniture = (['bed', 'wardrobe', 'desk', 'chair', 'lamp'] as ApartmentAssetId[]).map(id => fixtureItem(id));
  if (!starter) {
    plan.furniture.push(...(['sofa', 'coffee', 'kitchen', 'stool', 'bathroom', 'plant'] as ApartmentAssetId[]).map(id => fixtureItem(id)));
    plan.furniture.push(fixtureItem('stool', '-2', [-2.9, 1.8], 180), fixtureItem('plant', '-lounge', [-1.7, 3.8]), fixtureItem('plant', '-window', [5.3, -.4]));
    // The bathroom enclosure belongs to the shared reference architecture.
    // A second set of generic plan walls used to hide the bath and lounge.
  }
  return plan;
}
