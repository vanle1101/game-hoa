import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createFixedApartment } from "@/construction/migration";
import { buildPanoramaCurtainWallAssembly, classifyApartmentShellWall, wallKey } from "@/components/construction/render-geometry";
import type { BuildingPlan } from "@/construction/types";

vi.mock("react", async original => {
  const react = await original<typeof import("react")>();
  return { ...react,
    useRef: (value: unknown) => ({ current: value }),
    useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, vi.fn()],
    useMemo: (factory: () => unknown) => factory(),
    useCallback: (callback: unknown) => callback,
    useEffect: () => {},
    useLayoutEffect: () => {},
  };
});
vi.mock("@react-three/fiber", () => ({ Canvas: () => null, useFrame: () => {},
  useThree: (selector?: (state: unknown) => unknown) => {
    const camera = new THREE.PerspectiveCamera(); camera.position.set(11, 11, 13);
    const state = { camera, controls: { target: new THREE.Vector3() } };
    return selector ? selector(state) : state;
  },
}));
vi.mock("@react-three/drei", () => ({ Grid: () => null, Html: () => null, OrbitControls: () => null }));
vi.mock("@/components/world/Apartment", () => ({ Avatar: () => null, Fps: () => null, Furniture: () => null }));
vi.mock("@/components/world/ApartmentCity", () => ({ ApartmentCity: () => null, buildCityScene: () => ({ towers: [] }) }));
vi.mock("@/components/world/PetModel", () => ({ default: () => null }));
import { WorldScene } from "@/components/construction/ConstructionWorld";

type Props = Record<string, unknown> & { children?: ReactNode };
type Element = ReactElement<Props>;
function nodes(tree: ReactNode): Element[] {
  return Children.toArray(tree).flatMap(node => isValidElement<Props>(node) ? [node, ...nodes(node.props.children)] : []);
}
function renderer(node: Element) {
  const type = node.type as unknown as { type?: ((props: Props) => ReactNode) & { name: string } };
  return type.type;
}
function named(tree: ReactNode, name: string) {
  const node = nodes(tree).find(node => renderer(node)?.name === name);
  expect(node, `${name} is present in WorldScene`).toBeDefined();
  return node!;
}
function render(node: Element): ReactNode { return renderer(node)!(node.props); }
function finite(values: unknown, positive = false) {
  expect(Array.isArray(values)).toBe(true);
  for (const value of values as number[]) {
    expect(typeof value).toBe("number");
    expect(Number.isFinite(value)).toBe(true);
    if (positive) expect(value).toBeGreaterThan(0);
  }
}
function scene(plan?: BuildingPlan) {
  const fixed = createFixedApartment("2026-10-17T00:00:00.000Z");
  const onSelect = vi.fn();
  const tree = WorldScene({ plan: plan ?? fixed.plan, plot: fixed.plot, mode: "build", tool: "select", floorLevel: 0,
    onGesture: vi.fn(), onInteract: vi.fn(), onSelect, quality: "performance" });
  return { fixed, tree, onSelect, facade: render(named(tree, "PanoramaCurtainFacade")) };
}
function proxies(tree: ReactNode) { return nodes(tree).filter(node => node.type === "mesh" && typeof node.props.onClick === "function"); }

describe("V12 production panorama and exterior integration", () => {
  it("renders current bays and columns with finite panes and north/east orientation", () => {
    const { fixed, facade } = scene();
    const assembly = buildPanoramaCurtainWallAssembly(fixed.plot, 0);
    const units = nodes(facade).filter(node => renderer(node)?.name === "PanoramaUnitMesh");
    expect(units).toHaveLength(6);
    expect(assembly.bays.filter(bay => bay.orientation === "x")).toHaveLength(4);
    expect(assembly.bays.filter(bay => bay.orientation === "z")).toHaveLength(2);
    for (const unit of units) {
      const bay = unit.props.bay as typeof assembly.bays[number];
      const rendered = render(unit) as Element;
      expect(rendered.props.position).toEqual(bay.position);
      expect(rendered.props.rotation).toEqual([0, bay.orientation === "x" ? 0 : Math.PI / 2, 0]);
      finite(rendered.props.position);
      const panes = nodes(rendered).filter(node => (node.props.userData as { isPanoramaGlass?: boolean } | undefined)?.isPanoramaGlass);
      expect(panes.length).toBeGreaterThanOrEqual(2);
      for (const pane of panes) {
        finite(pane.props.position);
        expect(pane.props.raycast).toBeTypeOf("function");
        const geometry = nodes(pane).find(node => node.type === "planeGeometry")!;
        finite(geometry.props.args, true);
        const material = nodes(pane).find(node => node.type === "meshStandardMaterial")!;
        expect(material.props).toMatchObject({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
      }
    }
    for (const column of assembly.columns) {
      const blocks = nodes(facade).filter(node => typeof node.type === "function" && node.type.name === "Block");
      const body = blocks.find(node => JSON.stringify(node.props.position) === JSON.stringify(column.position));
      expect(body).toBeDefined();
      expect(body!.props.size).toEqual(column.size);
      finite(body!.props.size, true);
      expect(blocks.some(node => JSON.stringify(node.props.position) === JSON.stringify(column.trimPosition))).toBe(true);
    }
  });

  it("routes each panorama wall click through WorldScene selection", () => {
    const { fixed, facade, onSelect } = scene();
    const walls = fixed.plan.walls.filter(wall => ["panorama-north", "panorama-east-return"].includes(classifyApartmentShellWall(wall, fixed.plot, true)));
    const hits = proxies(facade);
    expect(hits).toHaveLength(walls.length);
    for (const [index, wall] of walls.entries()) {
      const stopPropagation = vi.fn();
      (hits[index].props.onClick as (event: { stopPropagation: () => void }) => void)({ stopPropagation });
      expect(stopPropagation).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenLastCalledWith({ kind: "wall", id: wallKey(wall) });
      expect(hits[index].props.rotation).toEqual([0, wall.orientation === "z" ? Math.PI / 2 : 0, 0]);
    }
  });

  it("exempts opaque and door walls without losing adjacent glass", () => {
    const fixed = createFixedApartment("2026-10-17T00:00:00.000Z");
    const north = fixed.plan.walls.find(wall => wall.orientation === "x" && wall.z === -5 && wall.x === 0)!;
    const east = fixed.plan.walls.find(wall => wall.orientation === "z" && wall.x === 6 && wall.z === -4)!;
    north.materialId = "wall-brick";
    east.opening = { kind: "door", catalogId: "door-standard" };
    const { facade } = scene(fixed.plan);
    const eligible = fixed.plan.walls.filter(wall => ["panorama-north", "panorama-east-return"].includes(classifyApartmentShellWall(wall, fixed.plot, true)));
    expect(proxies(facade)).toHaveLength(eligible.length);
    const units = nodes(facade).filter(node => renderer(node)?.name === "PanoramaUnitMesh");
    for (const unit of units) {
      expect(unit.props.walls).not.toContain(north);
      expect(unit.props.walls).not.toContain(east);
      const sections = Children.toArray((render(unit) as Element).props.children).filter(isValidElement);
      expect(sections.every(section => !String(section.key).includes(wallKey(north)) && !String(section.key).includes(wallKey(east)))).toBe(true);
    }
    expect(units.flatMap(unit => nodes(render(unit))).some(node => node.type === "planeGeometry")).toBe(true);
  });

  it("does not render a panorama facade for a nonfixed shell", () => {
    const fixed = createFixedApartment("2026-10-17T00:00:00.000Z");
    fixed.plan.floors = [];
    expect(scene(fixed.plan).facade).toBeNull();
  });

  it("renders the inhabited floor inside a retained full building envelope", () => {
    const { tree } = scene();
    const slab = named(tree, "ArchitecturalSlab");
    const rendered = render(slab);
    const blocks = nodes(rendered).filter(node => typeof node.type === "function" && node.type.name === "Block");
    for (const block of blocks) { finite(block.props.position); finite(block.props.size, true); }
    const envelope = render(named(rendered, "BuildingEnvelope"));
    expect(nodes(envelope).map(node => node.props.name).filter(Boolean)).toEqual([
      "residential-building", "building-below-residence", "building-above-residence", "apartment-structural-ceiling", "residence-lift-corridor",
    ]);
    expect(nodes(envelope).find(node => node.props.name === "residential-building")?.props.userData).toEqual({ residenceFloor: 16, apartmentElevation: 51, totalFloors: 28 });
    expect(nodes(envelope).find(node => node.props.name === "apartment-structural-ceiling")?.props.visible).toBe(false);
  });
});
