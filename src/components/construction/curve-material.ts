import type { CurveMaterial } from "@/construction/types";

export interface CurveGlassMaterial {
  color: string;
  transmission: number;
  roughness: number;
  opacity: number;
  metalness: number;
  ior: number;
  transparent: boolean;
  depthWrite: boolean;
}

const MATERIALS: Readonly<Record<CurveMaterial, Readonly<CurveGlassMaterial>>> = {
  clear: { color: "#e5f4f7", transmission: .92, roughness: .06, opacity: .86, metalness: 0, ior: 1.5, transparent: true, depthWrite: false },
  blue: { color: "#69afe8", transmission: .72, roughness: .1, opacity: .9, metalness: 0, ior: 1.5, transparent: true, depthWrite: false },
  violet: { color: "#b090dc", transmission: .64, roughness: .12, opacity: .9, metalness: 0, ior: 1.5, transparent: true, depthWrite: false },
  frosted: { color: "#dce7e8", transmission: .32, roughness: .65, opacity: .96, metalness: 0, ior: 1.5, transparent: true, depthWrite: false },
  smoke: { color: "#65717f", transmission: .46, roughness: .18, opacity: .94, metalness: 0, ior: 1.5, transparent: true, depthWrite: false },
};

export function curveGlassMaterial(material: string, state: { selected?: boolean; ghost?: boolean } = {}): CurveGlassMaterial {
  const preset = Object.hasOwn(MATERIALS, material) ? MATERIALS[material as CurveMaterial] : MATERIALS.clear;
  return { ...preset, opacity: state.ghost ? preset.opacity * .55 : preset.opacity };
}
