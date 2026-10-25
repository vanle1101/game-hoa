import { Box3, Vector3 } from "three";

export function fitPreviewBox(box: Box3, aspect: number, fov = 37, fill = .82) {
  const center = box.getCenter(new Vector3());
  const direction = new Vector3(1, .65, 1.25).normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  const vertical = Math.tan(fov * Math.PI / 360) * fill;
  const horizontal = vertical * Math.max(.1, aspect);
  let distance = .1;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const point = new Vector3(x, y, z).sub(center);
        const depth = point.dot(direction);
        distance = Math.max(distance, depth + Math.abs(point.dot(right)) / horizontal, depth + Math.abs(point.dot(up)) / vertical);
      }
    }
  }
  return { center, distance, position: center.clone().addScaledVector(direction, distance) };
}
