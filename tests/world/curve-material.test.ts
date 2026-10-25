import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CURVE_MATERIALS } from "../../src/construction/types";
import { curveGlassMaterial } from "../../src/components/construction/curve-material";

const modes = [
  { selected: false, ghost: false },
  { selected: true, ghost: false },
  { selected: false, ghost: true },
  { selected: true, ghost: true },
];

describe("persisted curved-glass material rendering", () => {
  it.each(modes)("keeps every persisted finish distinct for selected=$selected ghost=$ghost", mode => {
    const colors = new Set<string>(), transmissions = new Set<number>(), roughnesses = new Set<number>();
    for (const name of CURVE_MATERIALS) {
      const props = curveGlassMaterial(name, mode);
      const material = new THREE.MeshPhysicalMaterial({ ...props, thickness: .12, side: THREE.DoubleSide });
      expect(material.color.getHexString()).toBe(props.color.slice(1));
      expect(material.transmission).toBe(props.transmission);
      expect(material.roughness).toBe(props.roughness);
      expect(material.opacity).toBe(props.opacity);
      expect(material.thickness).toBe(.12);
      expect(material.transparent).toBe(true);
      expect(material.depthWrite).toBe(false);
      expect(material.emissive.getHex()).toBe(0);
      for (const value of [material.transmission, material.roughness, material.opacity]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      colors.add(material.color.getHexString());
      transmissions.add(material.transmission);
      roughnesses.add(material.roughness);
      material.dispose();
    }
    expect(colors.size).toBe(CURVE_MATERIALS.length);
    expect(transmissions.size).toBe(CURVE_MATERIALS.length);
    expect(roughnesses.size).toBe(CURVE_MATERIALS.length);
  });

  it.each(CURVE_MATERIALS)("preserves %s tint and optical finish during selection and ghost preview", name => {
    const ordinary = curveGlassMaterial(name);
    expect(curveGlassMaterial(name, { selected: true })).toEqual(ordinary);
    for (const selected of [false, true]) {
      const preview = curveGlassMaterial(name, { selected, ghost: true });
      expect(preview).toEqual({ ...ordinary, opacity: ordinary.opacity * .55 });
      expect(preview.opacity).toBeLessThan(ordinary.opacity);
    }
  });

  it("makes frosted diffuse, clear transmissive and smoke dark rather than catalog-tinted", () => {
    const clear = curveGlassMaterial("clear"), frosted = curveGlassMaterial("frosted"), smoke = curveGlassMaterial("smoke");
    expect(clear.transmission).toBeGreaterThan(frosted.transmission);
    expect(frosted.roughness).toBeGreaterThan(clear.roughness);
    expect(smoke.transmission).toBeLessThan(clear.transmission);
    expect(new THREE.Color(smoke.color).getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(new THREE.Color(clear.color).getHSL({ h: 0, s: 0, l: 0 }).l);
  });

  it("returns independent values and safely handles unknown legacy or prototype names", () => {
    const before = curveGlassMaterial("blue");
    const copy = curveGlassMaterial("blue"); copy.color = "#000000"; copy.opacity = 0;
    expect(curveGlassMaterial("blue")).toEqual(before);
    for (const unknown of ["", "missing", "constructor", "__proto__", "toString"]) expect(curveGlassMaterial(unknown)).toEqual(curveGlassMaterial("clear"));
  });

  it("wires persisted material and thickness into the real curve pane without tint overrides", () => {
    const source = readFileSync(new URL("../../src/components/construction/ConstructionWorld.tsx", import.meta.url), "utf8");
    expect(source).toContain('import { curveGlassMaterial } from "./curve-material"');
    expect(source).toContain("const glassMaterial = curveGlassMaterial(curve.material, { selected, ghost });");
    const pane = source.match(/<mesh geometry=\{geometry\.glass\}[\s\S]*?<\/mesh>/)?.[0];
    expect(pane).toBeDefined();
    expect(pane).toContain("<meshPhysicalMaterial");
    expect(pane).toContain("{...glassMaterial}");
    expect(pane).toContain("thickness={curve.thickness}");
    expect(pane).not.toMatch(/\b(color|emissive|opacity|transmission|roughness)=/);
  });
});
