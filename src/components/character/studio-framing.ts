import { Box3, Vector3 } from "three";

export function fitStudioCharacter(bounds: Box3, aspect: number, focus: "body" | "head", azimuth = 0, zoom = 1) {
  const box = bounds.clone();
  if (box.isEmpty()) box.set(new Vector3(-.4, 0, -.25), new Vector3(.4, 1.85, .25));
  if (focus === "head") {
    const height = box.max.y - box.min.y;
    const center = box.getCenter(new Vector3());
    box.min.set(center.x - height * .16, box.max.y - height * .3, center.z - height * .16);
    box.max.x = center.x + height * .16;
    box.max.z = center.z + height * .16;
  }
  const target = box.getCenter(new Vector3());
  const direction = new Vector3(Math.sin(azimuth), .025, Math.cos(azimuth)).normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  const fov = 32;
  const tangent = Math.tan(fov * Math.PI / 360) * .87;
  let distance = .1;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new Vector3(x, y, z).sub(target);
    distance = Math.max(distance, p.dot(direction) + Math.abs(p.dot(right)) / (tangent * Math.max(.2, aspect)),
      p.dot(direction) + Math.abs(p.dot(up)) / tangent);
  }
  distance /= Math.max(.65, Math.min(1.8, zoom));
  return { target, distance, fov, position: target.clone().addScaledVector(direction, distance) };
}
