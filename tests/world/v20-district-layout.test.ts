import { describe, expect, it } from 'vitest';
import { DISTRICT_LOTS, DISTRICT_ROADS, DISTRICT_GROUND_Y, PANORAMA_VIEW_CORRIDOR, WATERFRONT, NORTH_HARBOR, lotFootprintGap } from '../../src/components/world/v20/district-layout';
import { buildCityScene, maxAllowedTopY } from '../../src/components/world/ApartmentCity';

describe('V20 surveyed District 07', () => {
  it('keeps surveyed building footprints separated by usable streets and setbacks', () => {
    for (let i=0;i<DISTRICT_LOTS.length;i++) {
      const a=DISTRICT_LOTS[i];
      for (const b of DISTRICT_LOTS.slice(i+1)) expect(lotFootprintGap(a,b),`${a.name} / ${b.name}`).toBeGreaterThanOrEqual(8);
      for (const x of DISTRICT_ROADS.northSouth) expect(Math.abs(a.x-x)-a.width/2,`${a.name} north/south road`).toBeGreaterThanOrEqual(DISTRICT_ROADS.width/2+3);
      for (const z of DISTRICT_ROADS.eastWest) expect(Math.abs(a.z-z)-a.depth/2,`${a.name} east/west road`).toBeGreaterThanOrEqual(DISTRICT_ROADS.width/2+3);
      expect(Math.abs(a.x-WATERFRONT.x)-a.width/2,`${a.name} canal setback`).toBeGreaterThanOrEqual(WATERFRONT.width/2+3);
    }
  });
  it('protects both the apartment forecourt and northern panorama sightline', () => {
    const c=PANORAMA_VIEW_CORRIDOR;
    for(const lot of DISTRICT_LOTS){
      expect(Math.hypot(lot.x,lot.z)-Math.hypot(lot.width,lot.depth)/2).toBeGreaterThan(30);
      const overlaps=lot.x+lot.width/2>c.minX && lot.x-lot.width/2<c.maxX && lot.z+lot.depth/2>c.minZ && lot.z-lot.depth/2<c.maxZ;
      if(overlaps) expect(DISTRICT_GROUND_Y+lot.height).toBeLessThanOrEqual(c.maxTopY);
      expect(DISTRICT_GROUND_Y+lot.height).toBeLessThanOrEqual(maxAllowedTopY(lot.x,lot.z,lot.width/2,lot.depth/2));
    }
  });
  it('reserves a visible harbor between the near residential bank and landmark skyline', () => {
    const north = NORTH_HARBOR.z - NORTH_HARBOR.depth / 2;
    const south = NORTH_HARBOR.z + NORTH_HARBOR.depth / 2;
    expect(NORTH_HARBOR.x + NORTH_HARBOR.width / 2).toBe(WATERFRONT.x - WATERFRONT.width / 2);
    for (const lot of DISTRICT_LOTS) {
      const acrossHarbor = lot.x + lot.width / 2 > NORTH_HARBOR.x - NORTH_HARBOR.width / 2 &&
        lot.x - lot.width / 2 < NORTH_HARBOR.x + NORTH_HARBOR.width / 2;
      if (acrossHarbor) {
        const bankGap = Math.max(lot.z - lot.depth / 2 - south, north - lot.z - lot.depth / 2);
        expect(bankGap, `${lot.name} harbor setback`).toBeGreaterThanOrEqual(20);
      }
      // This full-height view wedge is what the reference camera actually sees.
      const inPanorama = lot.x + lot.width / 2 > -24 && lot.x - lot.width / 2 < 24 &&
        lot.z + lot.depth / 2 > -224 && lot.z - lot.depth / 2 < -96;
      expect(inPanorama, `${lot.name} panorama occlusion`).toBe(false);
    }
  });
  it('uses mixed heights, named districts, distinct silhouettes and all eight compass directions', () => {
    expect(new Set(DISTRICT_LOTS.map(l=>l.zone)).size).toBe(3);
    expect(new Set(DISTRICT_LOTS.map(l=>l.archetype)).size).toBe(6);
    expect(DISTRICT_LOTS.some(l=>l.height<20)).toBe(true);
    expect(DISTRICT_LOTS.some(l=>l.height>100)).toBe(true);
    const sectors=new Set(DISTRICT_LOTS.map(l=>Math.floor(((Math.atan2(l.x,l.z)+Math.PI*2)%(Math.PI*2))/(Math.PI/4))));
    expect(sectors.size).toBe(8);
    for(const lot of DISTRICT_LOTS.filter(l=>l.height>60)) expect(Math.hypot(lot.x,lot.z)).toBeGreaterThan(140);
  });
  it('never moves or adds a building when the graphics quality changes', () => {
    expect(buildCityScene('performance').towers).toEqual(buildCityScene('ultra').towers);
    expect(buildCityScene().towers).toHaveLength(DISTRICT_LOTS.length);
    expect(buildCityScene()).toEqual(buildCityScene());
    for(const layer of buildCityScene().layers) for(const instances of Object.values(layer)) for(const i of instances){
      expect(i.position.every(Number.isFinite)).toBe(true);
      expect(i.scale.every(n=>Number.isFinite(n)&&n>0)).toBe(true);
    }
  });
});
