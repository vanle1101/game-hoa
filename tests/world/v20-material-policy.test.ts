import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('V20 imported architecture material policy', () => {
  const source = readFileSync(new URL('../../src/components/world/v20/DistrictBuildings.tsx', import.meta.url), 'utf8');

  it('grades the complete Kenney daytime palette into readable titanium panels', () => {
    expect(source).toContain('districtTitanium=mix');
    expect(source).toContain('districtSourceLuma=dot(diffuseColor.rgb');
    expect(source).toContain('districtTitanium+=vec3(.014,.009,.028)*districtSaturation');
    expect(source).not.toContain('districtGlass=step(diffuseColor.r*1.16');
  });

  it('limits warm/cyan emission to classified occupied window panes', () => {
    expect(source).toContain('districtWindowMask=smoothstep(.20,.39,districtSourceLuma)');
    expect(source).toContain('float pane=step(.14,across)');
    expect(source).toContain('totalEmissiveRadiance+=(districtWindowMask*.68+.24)*windowLight*step(.48,occupied)*pane*1.56*districtScale');
    expect(source).toContain('*(1.0-step(.35,abs(faceNormal.y)))');
    expect(source).toContain('vec3 districtGrid=vDistrictWorld/vec3(2.7,3.1,2.7)');
  });
});
