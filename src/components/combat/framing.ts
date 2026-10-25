import { Box3, Vector3 } from "three";

export const COMBAT_SUBJECT_BOUNDS = new Box3(new Vector3(-3, 0, -2), new Vector3(4, 3.9, 2.2));

export function combatFraming(aspect: number) {
  const target = new Vector3(0, 1.35, 0);
  const direction = new Vector3(7, 3.2, 8).normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  const tanY = Math.tan(43 * Math.PI / 360);
  const tanX = tanY * Math.max(.2, Number.isFinite(aspect) ? aspect : 1);
  let distance = Math.sqrt(7 * 7 + 3.2 * 3.2 + 8 * 8);
  for (const x of [COMBAT_SUBJECT_BOUNDS.min.x, COMBAT_SUBJECT_BOUNDS.max.x]) {
    for (const y of [COMBAT_SUBJECT_BOUNDS.min.y, COMBAT_SUBJECT_BOUNDS.max.y]) {
      for (const z of [COMBAT_SUBJECT_BOUNDS.min.z, COMBAT_SUBJECT_BOUNDS.max.z]) {
        const relative = new Vector3(x, y, z).sub(target);
        const depth = relative.dot(direction);
        distance = Math.max(distance, depth + Math.abs(relative.dot(right)) / (tanX * .82), depth + Math.abs(relative.dot(up)) / (tanY * .82));
      }
    }
  }
  return { target, position: direction.multiplyScalar(distance).add(target), distance };
}
