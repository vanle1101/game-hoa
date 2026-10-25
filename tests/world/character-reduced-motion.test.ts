import { readFileSync } from "node:fs";
import { Children, isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const observed = vi.hoisted(() => ({ paused: [] as boolean[] }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef: (initial: unknown) => ({ current: initial }),
  };
});
vi.mock("@react-three/fiber", () => ({ Canvas: () => null, useFrame: () => {}, useThree: () => ({}) }));
vi.mock("@react-three/drei", () => ({ ContactShadows: () => null, Grid: () => null, Html: () => null, OrbitControls: () => null }));
vi.mock("../../src/components/world/CharacterModel", () => ({ CharacterModel: ({ paused }: { paused: boolean }) => { observed.paused.push(paused); return null; } }));
import { Avatar } from "../../src/components/world/Apartment";

function evaluateTree(node: ReactNode): void {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (typeof child.type === "function") {
      evaluateTree((child.type as (props: unknown) => ReactNode)(child.props));
    } else if (child.props?.children) {
      evaluateTree(child.props.children);
    }
  }
}

const apartment = readFileSync("src/components/world/Apartment.tsx", "utf8");
const studio = readFileSync("src/components/character/CharacterStudio.tsx", "utf8");
const model = readFileSync("src/components/world/CharacterModel.tsx", "utf8");

describe("character preview reduced motion", () => {
  it.each([
    { only: true, reducedMotion: true, expected: true },
    { only: true, reducedMotion: false, expected: false },
    { only: false, reducedMotion: true, expected: false },
    { only: false, reducedMotion: false, expected: false },
  ])("passes paused=$expected for only=$only reducedMotion=$reducedMotion", ({ only, reducedMotion, expected }) => {
    observed.paused.length = 0;
    evaluateTree(Avatar({ path: [], only, reducedMotion }));
    expect(observed.paused).toEqual([expected]);
  });

  it("preserves the default animated creator", () => {
    observed.paused.length = 0;
    evaluateTree(Avatar({ path: [], only: true }));
    expect(observed.paused).toEqual([false]);
  });

  it("keeps world travel and combat animation unpaused", () => {
    for (const activity of ["walk", "attack", "heavy", "dodge", "block", "working"]) {
      observed.paused.length = 0;
      evaluateTree(Avatar({ path: [{ x: 2, z: 2 }], reducedMotion: true, activity }));
      expect(observed.paused).toEqual([false]);
    }
  });

  it("wires saved and reactive system preference through the scene", () => {
    expect(studio).toContain("reducedMotion={state.settings.reducedMotion}");
    expect(apartment).toContain("useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion)");
    expect(apartment).toContain("Boolean(props.reducedMotion || systemReducedMotion)");
    expect(apartment).toContain('query.addEventListener("change", onChange)');
    expect(apartment).toContain('query.removeEventListener("change", onChange)');
    expect(apartment).toContain("{...props} reducedMotion={reducedMotion}");
    expect(apartment).toContain("only={props.characterOnly} reducedMotion={props.reducedMotion}");
    expect(model.indexOf("if (paused) return;")).toBeLessThan(model.indexOf("t = clock.elapsedTime"));
  });
});
