import { readFileSync } from "node:fs";
import { createElement, isValidElement, type ReactNode } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../../src/components/housing/ResidencePreview.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("ResidencePreview.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = parsed.statements.filter(ts.isFunctionDeclaration);
const cameraFunction = functions.find(node => node.name?.text === "CameraPosition")!;
const effects = cameraFunction.body!.statements.filter(ts.isExpressionStatement)
  .map(node => node.expression).filter(ts.isCallExpression)
  .filter(node => node.expression.getText(parsed) === "useEffect");
const cameraCode = ts.transpileModule(`const effect = ${effects[0].arguments[0].getText(parsed)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText;
const framingCode = ts.transpileModule(`${functions.find(node => node.name?.text === "updatePreviewProjection")!.getText(parsed)}\nconst effect = ${effects.find(node => node.arguments[0].getText(parsed).includes("camera.fov"))!.arguments[0].getText(parsed)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText;
const applyCamera = new Function("camera", "floor", "mode", "controls", "invalidate", "gl", "PerspectiveCamera", `${cameraCode}\neffect();`);
const applyFraming = new Function("camera", "mode", "gl", "invalidate", "PerspectiveCamera", `${framingCode}\neffect();`);

function Block() { return null; }
const sceneCode = ts.transpileModule(functions.filter(node => ["Skyline", "Tower"].includes(node.name?.text ?? ""))
  .map(node => node.getText(parsed)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
}).outputText;
const scene = new Function("React", "Block", "FLOORS", "ACCENTS", `${sceneCode}\nreturn { Skyline, Tower };`)(
  { createElement }, Block, [8, 16, 24], { "neon-haven": "#51e5e1" },
) as { Skyline: () => ReactNode; Tower: (props: { floor: number; buildingId: string }) => ReactNode };

type Geometry = { at: Vector3; size: [number, number, number] };
function blocks(node: ReactNode, offset = new Vector3()): Geometry[] {
  if (Array.isArray(node)) return node.flatMap(child => blocks(child, offset));
  if (!isValidElement<{ at?: [number, number, number]; size?: [number, number, number]; position?: [number, number, number]; children?: ReactNode }>(node)) return [];
  if (node.type === Block) return [{ at: offset.clone().add(new Vector3(...node.props.at!)), size: node.props.size! }];
  return blocks(node.props.children, offset.clone().add(new Vector3(...(node.props.position ?? [0, 0, 0]))));
}
function corners({ at, size }: Geometry) {
  return [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => at.clone().add(new Vector3(x * size[0] / 2, y * size[1] / 2, z * size[2] / 2)))));
}
const skylineRoofs = blocks(scene.Skyline()).filter(block => block.size[1] === .16);
const tower = blocks(scene.Tower({ floor: 8, buildingId: "neon-haven" }));
const towerRoof = tower.filter(block => block.size[1] === .6);
const roofCorners = [...skylineRoofs, ...towerRoof].flatMap(corners);
const cameraFov = Number(source.match(/camera=\{\{ fov: ([\d.]+)/)?.[1]);
const viewports = [[771, 372], [771, 315], [356, 219], [356, 200], [300, 250]] as const;

function framed(mode: "city" | "floor" | "room", floor: number, aspect: number, welcome: boolean) {
  const camera = new PerspectiveCamera(cameraFov, aspect, .1, 220);
  const target = new Vector3();
  const update = vi.fn();
  const invalidate = vi.fn();
  const closest = vi.fn((selector: string) => welcome && selector === ".housing-welcome" ? {} : null);
  applyCamera(camera, floor, mode, { current: { target, update } }, invalidate, { domElement: { closest } }, PerspectiveCamera);
  applyFraming(camera, mode, { domElement: { closest } }, invalidate, PerspectiveCamera);
  camera.updateMatrixWorld();
  return { camera, target, update, invalidate };
}

describe("housing welcome roof framing", () => {
  it("binds the regression to the rendered tower and every skyline roof", () => {
    expect(cameraFov).toBe(43);
    expect(skylineRoofs).toHaveLength(22);
    expect(towerRoof).toHaveLength(1);
    expect(roofCorners).toHaveLength(184);
    const { camera } = framed("city", 8, 771 / 372, false);
    expect(Math.max(...roofCorners.map(point => point.clone().project(camera).y))).toBeGreaterThan(1);
  });

  it.each([8, 16, 24])("keeps all roof tops below the welcome top edge on floor %s", floor => {
    for (const [width, height] of viewports) {
      const { camera } = framed("city", floor, width / height, true);
      const projected = roofCorners.map(point => point.clone().project(camera));
      expect(Math.max(...projected.map(point => point.y))).toBeLessThanOrEqual(.9);
      for (const point of projected) {
        expect(point.z).toBeGreaterThan(-1);
        expect(point.z).toBeLessThan(1);
      }
      for (const point of towerRoof.flatMap(corners).map(point => point.project(camera))) {
        expect(Math.abs(point.x)).toBeLessThan(1);
        expect(Math.abs(point.y)).toBeLessThan(1);
      }
    }
  });

  it.each([8, 16, 24])("retains non-welcome city and floor camera behavior at floor %s", floor => {
    for (const mode of ["city", "floor"] as const) {
      const { camera, target, update, invalidate } = framed(mode, floor, 1.8, false);
      expect(camera.position.toArray()).toEqual([mode === "city" ? 25 : 18, floor * .72 + 7, mode === "city" ? 33 : 25]);
      expect(target.toArray()).toEqual([0, floor * .72, 0]);
      expect(camera.fov).toBe(43);
      expect(update).toHaveBeenCalledOnce();
      expect(invalidate).toHaveBeenCalledExactlyOnceWith(3);
    }
  });

  it("preserves the room camera even inside a welcome ancestor", () => {
    for (const floor of [8, 16, 24]) {
      const { camera, target } = framed("room", floor, 1.8, true);
      expect(camera.position.toArray()).toEqual([10.5, 10.5, 12.5]);
      expect(target.toArray()).toEqual([0, .6, 0]);
      expect(camera.fov).toBe(43);
    }
    expect(source).toContain('<group position={[0, -floor * .72 * .65 - 10, -18]} scale={.65}><Skyline /></group>');
  });

  it("restores normal projection when the same canvas leaves welcome", () => {
    const { camera } = framed("city", 8, 1.8, true);
    const invalidate = vi.fn();
    applyFraming(camera, "city", { domElement: { closest: () => null } }, invalidate, PerspectiveCamera);
    expect(camera.fov).toBe(43);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith(3);
    const normal = framed("city", 8, 1.8, false).camera;
    expect(camera.projectionMatrix.elements).toEqual(normal.projectionMatrix.elements);
  });

  it("does not reset orbit position or redraw an unchanged welcome frame", () => {
    const { camera } = framed("city", 8, 1.8, true);
    camera.position.set(30, 20, 35);
    camera.lookAt(1, 10, 2);
    const rotation = camera.quaternion.clone();
    const invalidate = vi.fn();
    applyFraming(camera, "city", { domElement: { closest: () => ({}) } }, invalidate, PerspectiveCamera);
    expect(camera.position.toArray()).toEqual([30, 20, 35]);
    expect(camera.quaternion.equals(rotation)).toBe(true);
    expect(invalidate).not.toHaveBeenCalled();
    const framingEffect = effects.find(node => node.arguments[0].getText(parsed).includes("camera.fov"))!;
    expect(framingEffect.arguments).toHaveLength(1);
  });

  it("preserves public interactions, captions and rendering performance settings", () => {
    expect(source).toContain('onClick={event => { event.stopPropagation(); onFloorChange?.(value); }}');
    expect(source).toContain('frameloop="always" dpr={performance ? 1 : [1, 1.5]}');
    expect(source).toContain('gl={{ antialias: !performance, alpha: false }}');
    expect(source).toContain('minDistance={mode === "room" ? 10 : 16} maxDistance={mode === "room" ? 32 : 58}');
    expect(source).toContain('`TẦNG ${floor} / 28`');
    expect(source).not.toMatch(/<img|TextureLoader|backgroundImage/);
  });
});
