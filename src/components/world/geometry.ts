import { FURNITURE, ROOMS } from "@/domain/catalog";

export type Point = { x: number; z: number };
export type Bounds = Point & { width: number; depth: number };
export type Fixture = Bounds & { kind: string; rotation?: number; screen?: string; label?: string; activity?: "working" | "sitting" | "sleeping"; approach?: Point };
const fixture = (kind: string, x: number, z: number, width: number, depth: number, extra: Partial<Fixture> = {}): Fixture => ({ kind, x, z, width, depth, ...extra });
export function roomDimensions(roomId = "living") { const room = ROOMS.find(room => room.id === roomId) ?? ROOMS[0]; return { width: room.width, depth: room.depth, name: room.name }; }
export function getRoomFixtures(roomId = "living"): Fixture[] {
  if (roomId === "training") return [fixture("training-rack", -4.4, -2.8, 2.2, 1.2, { screen: "skills", label: "Rèn luyện kỹ năng" }), fixture("training-bag", 4.2, -2.6, 1.1, 1.1, { screen: "bosses", label: "Bảng thử thách" }), fixture("bench", -4.8, 1.8, 1.5, .7, { screen: "recovery", label: "Nghỉ giữa hiệp", activity: "sitting", approach: { x: -4.8, z: 2.8 } })];
  if (roomId === "workshop") return [fixture("workbench", -3.5, -3.2, 2.3, 1, { screen: "crafting", label: "Bàn chế tạo", activity: "working", approach: { x: -3.5, z: -1.9 } }), fixture("tool-wall", 3.5, -3.5, 2.5, .65, { screen: "inventory", label: "Kho nguyên liệu" }), fixture("fabricator", 4.6, 1.8, 1.7, 1.5, { screen: "crafting", label: "Máy gia công" })];
  if (roomId === "gaming") return [fixture("gaming-desk", -3.6, -3.1, 2.3, 1, { screen: "focus", label: "Trạm tập trung", activity: "working", approach: { x: -3.6, z: -1.8 } }), fixture("sofa", 3.7, .6, 2.9, 1.16, { screen: "recovery", label: "Không gian thư giãn", activity: "sitting", approach: { x: 3.7, z: 1.8 } }), fixture("arcade", 4.8, -3.2, 1.25, 1.1, { screen: "farming", label: "Thử thách mỗi ngày" })];
  if (roomId === "trophy") return [-4.4, 0, 4.4].map((x, index) => fixture(index === 1 ? "trophy-plinth" : "trophy", x, -2.8, 1.65, .7, { screen: "achievements", label: index === 1 ? "Thành tựu của bạn" : "Bộ sưu tập" }));
  if (roomId === "premium") return [fixture("bed", 4.5, -2.6, 2.7, 3.2, { screen: "recovery", label: "Sky suite · Nghỉ ngơi", activity: "sleeping", approach: { x: 2.6, z: -1.6 } }), fixture("sofa", -3.8, -.6, 2.9, 1.16, { screen: "recovery", label: "Sky lounge", activity: "sitting", approach: { x: -3.8, z: .7 } }), fixture("terminal", -3.8, -3.3, 2.3, 1, { screen: "butler", label: "NOVA · Quản gia" }), fixture("coffee-table", -3.8, 1.5, 1.3, .8), fixture("plant", 5.5, 3.5, .6, .6)];
  return [fixture("desk", -4.9, -3.2, 2.3, 1, { screen: "quests", label: "Nhiệm vụ & kế hoạch", activity: "working", approach: { x: -4.9, z: -1.95 } }), fixture("sofa", -4.8, .5, 1.16, 2.9, { rotation: 90, screen: "focus", label: "Tập trung", activity: "sitting", approach: { x: -3.7, z: .5 } }), fixture("bed", 4.7, -2.7, 2.7, 3.2, { screen: "recovery", label: "Nghỉ ngơi & hồi phục", activity: "sleeping", approach: { x: 2.8, z: -1.8 } }), fixture("wardrobe", 5.9, .5, .6, 1.65, { rotation: -90, screen: "equipment", label: "Tủ trang bị" }), fixture("terminal", 1.3, -3.8, 2.3, 1, { screen: "butler", label: "NOVA · Quản gia AI", activity: "working", approach: { x: 1.3, z: -2.45 } }), fixture("trophy", -5.9, 3.2, .6, 1.65, { rotation: 90, screen: "achievements", label: "Bộ sưu tập thành tựu" }), fixture("workbench", 4.7, 3.6, 2.3, 1, { screen: "crafting", label: "Xưởng chế tạo", activity: "working", approach: { x: 4.7, z: 2.4 } }), fixture("coffee-table", -2.9, .5, 1.15, 1.8), fixture("plant", -5.8, -4, .55, .55), fixture("plant", 2.8, -3.8, .55, .55), fixture("lamp", 3.1, -3.5, .5, .5)];
}
export function furnitureBounds(kind: string, rotation = 0): { width: number; depth: number } {
  const definition = FURNITURE.find(item => item.id === kind);
  let width = definition?.width ?? 1.3, depth = definition?.depth ?? .8;
  if (!definition) {
    if (/desk|work|terminal/.test(kind)) { width = 2.3; depth = 1; }
    else if (/sofa/.test(kind)) { width = 2.9; depth = 1.16; }
    else if (/bed/.test(kind)) { width = 2.7; depth = 3.2; }
    else if (/plant|lamp/.test(kind)) { width = .6; depth = .6; }
    else if (/shelf|trophy|wardrobe/.test(kind)) { width = 1.65; depth = .6; }
  }
  return Math.abs(rotation % 180) === 90 ? { width: depth, depth: width } : { width, depth };
}
export function overlaps(a: Bounds, b: Bounds, margin = 0) { return Math.abs(a.x - b.x) < (a.width + b.width) / 2 + margin && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + margin; }
export function placementValid(candidate: Bounds, room: { width: number; depth: number }, obstacles: Bounds[]) { return Math.abs(candidate.x) + candidate.width / 2 <= room.width / 2 && Math.abs(candidate.z) + candidate.depth / 2 <= room.depth / 2 && !obstacles.some(obstacle => overlaps(candidate, obstacle)); }
export function walkable(point: Point, room: { width: number; depth: number }, obstacles: Bounds[], radius = .28) { return placementValid({ ...point, width: radius * 2, depth: radius * 2 }, room, obstacles); }
function clearSegment(from: Point, to: Point, room: { width: number; depth: number }, obstacles: Bounds[]) { const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / .12); for (let step = 1; step <= steps; step++) if (!walkable({ x: from.x + (to.x - from.x) * step / steps, z: from.z + (to.z - from.z) * step / steps }, room, obstacles)) return false; return true; }
/** A bounded four-neighbour grid avoids diagonal corner clipping and finds the closest reachable floor point. */
export function findPath(start: Point, desired: Point, room: { width: number; depth: number }, obstacles: Bounds[]): Point[] {
  if (walkable(desired, room, obstacles) && clearSegment(start, desired, room, obstacles)) return [desired];
  const step = .35, columns = Math.floor(room.width / step), rows = Math.floor(room.depth / step);
  const point = (index: number) => ({ x: -room.width / 2 + (index % columns + .5) * step, z: -room.depth / 2 + (Math.floor(index / columns) + .5) * step });
  const nodes = Array.from({ length: columns * rows }, (_, index) => index).filter(index => walkable(point(index), room, obstacles));
  const reachableStarts = nodes.filter(index => clearSegment(start, point(index), room, obstacles));
  if (!reachableStarts.length) return [];
  const first = reachableStarts.reduce((best, node) => Math.hypot(point(node).x - start.x, point(node).z - start.z) < Math.hypot(point(best).x - start.x, point(best).z - start.z) ? node : best);
  const allowed = new Set(nodes), queue = [first], previous = new Map<number, number>([[first, -1]]);
  let closest = first, distance = Infinity;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], p = point(current), nextDistance = Math.hypot(p.x - desired.x, p.z - desired.z);
    if (nextDistance < distance) { closest = current; distance = nextDistance; }
    for (const next of [current - columns, current + columns, ...(current % columns > 0 ? [current - 1] : []), ...(current % columns < columns - 1 ? [current + 1] : [])]) if (allowed.has(next) && !previous.has(next) && clearSegment(p, point(next), room, obstacles)) { previous.set(next, current); queue.push(next); }
  }
  const path: Point[] = []; for (let node = closest; node !== -1; node = previous.get(node) ?? -1) path.unshift(point(node));
  const compact: Point[] = []; let cursor = start;
  for (let i = 0; i < path.length;) { let farthest = i; while (farthest + 1 < path.length && clearSegment(cursor, path[farthest + 1], room, obstacles)) farthest++; compact.push(path[farthest]); cursor = path[farthest]; i = farthest + 1; }
  if (walkable(desired, room, obstacles) && clearSegment(cursor, desired, room, obstacles)) compact.push(desired);
  return compact;
}
