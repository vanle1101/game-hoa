import { readFileSync } from "node:fs";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../src/components/housing/ResidencePreview.tsx", import.meta.url), "utf8");
const cameraMatch = source.match(/if \(mode === "room"\) camera\.position\.set\(([^)]+)\)/);
const roomPosition = cameraMatch?.[1].split(",").map(Number);
const skylineMatch = source.match(/<group position=\{\[0, -floor \* ([\d.]+) \* ([\d.]+) - ([\d.]+), (-?[\d.]+)\]\} scale=\{([\d.]+)\}><Skyline \/><\/group>/);

function cameraAt(position: number[], aspect: number) {
  const camera = new PerspectiveCamera(43, aspect, .1, 220);
  camera.position.set(position[0], position[1], position[2]);
  camera.lookAt(0, .6, 0);
  camera.updateMatrixWorld();
  return camera;
}

function roomBounds(camera: PerspectiveCamera, width: number, depth: number) {
  const points: Vector3[] = [];
  for (const x of [-width / 2 - .09, width / 2 + .09]) {
    for (const y of [-.31, 3.565]) {
      for (const z of [-depth / 2 - .1, depth / 2 + .1]) {
        points.push(new Vector3(x, y, z).project(camera));
      }
    }
  }
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  return { area: (maxX - minX) * (maxY - minY), points };
}

describe("housing room composition", () => {
  it("uses explicit room-only framing without changing the city/floor camera", () => {
    expect(roomPosition).toHaveLength(3);
    expect(roomPosition?.every(Number.isFinite)).toBe(true);
    expect(source).toContain('else camera.position.set(mode === "city" ? 25 : 18, height + 7, mode === "city" ? 33 : 25);');
    expect(source).toContain('camera.lookAt(0, mode === "room" ? .6 : height, 0);');
    expect(source).toContain('controls.current?.target.set(0, mode === "room" ? .6 : height, 0);');
  });

  it.each([
    ["studio", 8, 8],
    ["one-bedroom", 10, 10],
    ["open-plan", 10, 8],
  ] as const)("enlarges %s while retaining its full initial bounds", (_, width, depth) => {
    expect(roomPosition).toBeDefined();
    for (const aspect of [1.2, 1.4, 1.8, 2.2]) {
      const current = roomBounds(cameraAt(roomPosition!, aspect), width, depth);
      const previous = roomBounds(cameraAt([13, 12, 15], aspect), width, depth);
      expect(current.area / previous.area).toBeGreaterThan(1.4);
      for (const point of current.points) {
        expect(Math.abs(point.x)).toBeLessThan(1);
        expect(Math.abs(point.y)).toBeLessThan(1);
        expect(point.z).toBeGreaterThan(-1);
        expect(point.z).toBeLessThan(1);
      }
    }
  });

  it.each([8, 16, 24])("retains a smaller distant skyline on floor %s", floor => {
    expect(skylineMatch).not.toBeNull();
    const [, floorHeight, floorScale, drop, zOffset, scale] = skylineMatch!.map(Number);
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThanOrEqual(.7);
    expect(floorScale).toBe(scale);
    expect(zOffset).toBeLessThan(-5);
    const camera = cameraAt(roomPosition!, 1.4);
    let visibleRoofs = 0;
    for (let i = 0; i < 22; i++) {
      const x = ((i * 13) % 47) - 23;
      const z = -12 - (i % 4) * 9;
      const height = 5 + (i * 7) % 24;
      const baseY = -floor * floorHeight * floorScale - drop;
      const base = new Vector3(x * scale, baseY, z * scale + zOffset).project(camera);
      const roof = new Vector3(x * scale, baseY + height * scale, z * scale + zOffset).project(camera);
      const oldBase = new Vector3(x, -floor * .72, z - 5).project(camera);
      const oldRoof = new Vector3(x, height - floor * .72, z - 5).project(camera);
      expect(roof.distanceTo(base)).toBeLessThan(oldRoof.distanceTo(oldBase) * .7);
      if (Math.abs(roof.x) < 1 && Math.abs(roof.y) < 1 && Math.abs(roof.z) < 1) visibleRoofs++;
    }
    expect(visibleRoofs).toBeGreaterThanOrEqual(10);
    expect(source).toContain(': <><Skyline /><Tower floor={floor} buildingId={buildingId} onFloorChange={onFloorChange} /></>');
  });
});
