import { createElement, isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { CharacterModel, type ModelCharacter } from "@/components/world/CharacterModel";
import { faceShape, headMeshData } from "@/components/world/character-shape";

vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
}));
vi.mock("@react-three/fiber", () => ({ useFrame: () => {} }));

type Props = { children?: ReactNode; name?: string; color?: string; roughness?: number; geometry?: THREE.BufferGeometry; position?: number[]; scale?: number[] };
type Surface = { name: string; geometry?: THREE.BufferGeometry; material: Props };
function surfaces(character: ModelCharacter): Surface[] {
  const result: Surface[] = [];
  function visit(node: ReactNode, surface?: Surface): void {
    if (Array.isArray(node)) { node.forEach(child => visit(child, surface)); return; }
    if (!isValidElement<Props>(node)) return;
    if (typeof node.type === "function") {
      visit((node.type as (props: Props) => ReactNode)(node.props), surface);
      return;
    }
    if (node.type === "mesh") {
      surface = { name: node.props.name ?? "", geometry: node.props.geometry, material: {} };
      result.push(surface);
    }
    if (typeof node.type === "string" && node.type.endsWith("Material") && surface) surface.material = node.props;
    visit(node.props.children, surface);
  }
  visit(createElement(CharacterModel, { paused: true, character }));
  return result;
}
function luminance(color: string): number {
  const { r, g, b } = new THREE.Color(color);
  return .2126 * r + .7152 * g + .0722 * b;
}

const palettes = [
  { skin: "#f1c9ae", hair: "#ddd2bc" },
  { skin: "#bb8b74", hair: "#17191e" },
  { skin: "#573c32", hair: "#856245" },
];

describe("facial material readability", () => {
  it.each(palettes)("keeps eye and lip separation for $skin / $hair", character => {
    const rendered = surfaces(character);
    const material = (name: string) => {
      const matches = rendered.filter(surface => surface.name === name);
      expect(matches).toHaveLength(name.includes("lip") ? 1 : 2);
      matches.forEach(match => expect(match.material).toEqual(matches[0].material));
      return matches[0].material;
    };
    const white = material("eye-white"), upperLid = material("upper-lid");
    expect(luminance(white.color!) - luminance(upperLid.color!)).toBeGreaterThan(.5);
    expect(upperLid.roughness).toBeGreaterThan(white.roughness!);
    expect(material("lid-fold").color).not.toBe(new THREE.Color(character.skin).getStyle());
    const upperLip = material("upper-lip"), lowerLip = material("lower-lip");
    expect(luminance(lowerLip.color!)).toBeGreaterThan(luminance(upperLip.color!));
    expect(upperLip.roughness).toBeGreaterThan(lowerLip.roughness!);
    const brow = material("brow-surface");
    expect(brow.roughness).toBeGreaterThanOrEqual(.8);
    expect(luminance(brow.color!)).toBeLessThan(luminance(white.color!));
  });

  it.each([0, 1, 2, 3, 4, 5])("preserves head geometry and projected feature surfaces for face %i", facePreset => {
    const rendered = surfaces({ appearance: { facePreset, eyePreset: facePreset, mouthPreset: facePreset, browPreset: facePreset } });
    const head = rendered.find(surface => surface.name === "head-surface")!.geometry!;
    expect(Array.from(head.getAttribute("position").array)).toEqual(headMeshData(faceShape(facePreset)).positions.map(Math.fround));
    for (const name of ["eye-white", "upper-lid", "lower-lid", "lid-fold", "brow-surface", "upper-lip", "lower-lip"]) {
      for (const surface of rendered.filter(item => item.name === name)) {
        expect(surface.geometry!.getIndex()!.count).toBeGreaterThan(0);
        expect(Array.from(surface.geometry!.getAttribute("position").array).every(Number.isFinite)).toBe(true);
      }
    }
  });
});
