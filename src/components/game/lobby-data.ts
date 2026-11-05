import { FURNITURE, ITEMS } from "@/domain/catalog";
import type { GameState, Task } from "@/domain/types";

export type LobbyDestination = "calendar" | "character" | "finance" | "furniture" | "home" | "inventory" | "journal" | "lobby" | "quests" | "rewards" | "shop" | "butler";
export type LobbySearchResult = { id: string; label: string; detail: string; screen: LobbyDestination; searchText?: string };
export type LobbyRoom = "Phòng khách" | "Phòng ngủ" | "Góc làm việc" | "Nhà bếp" | "Ban công";

const navigation: LobbySearchResult[] = [
  { id: "lobby", label: "Hôm nay", detail: "Sảnh chờ", screen: "lobby" },
  { id: "calendar", label: "Kế hoạch", detail: "Lịch trình", screen: "calendar" },
  { id: "character", label: "Nhân vật", detail: "Hồ sơ", screen: "character" },
  { id: "home", label: "Căn hộ", detail: "Thế giới 3D", screen: "home" },
  { id: "rewards", label: "Phần thưởng", detail: "Đổi vàng trong game", screen: "rewards" },
  { id: "finance", label: "Tài chính", detail: "Sổ tiền thật", screen: "finance" },
  { id: "journal", label: "Nhật ký", detail: "Hoạt động", screen: "journal" },
  { id: "furniture", label: "Nội thất", detail: "Cửa hàng căn hộ", screen: "furniture" },
  { id: "shop", label: "Trang bị", detail: "Cửa hàng", screen: "shop" },
  { id: "butler", label: "NOVA AI", detail: "Quản gia", screen: "butler" },
];

export function normalizeLobbySearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi-VN").trim();
}

export function lobbySearch(state: GameState, text: string): LobbySearchResult[] {
  const query = normalizeLobbySearch(text);
  if (!query) return [];
  const results: LobbySearchResult[] = [
    ...navigation,
    ...state.tasks.filter(task => !task.archived).map(task => ({ id: `task:${task.id}`, label: task.title, detail: "Nhiệm vụ của bạn", screen: "quests" as const, searchText: task.description })),
    ...state.journal.slice(-30).reverse().map(entry => ({ id: `journal:${entry.id}`, label: entry.title, detail: "Nhật ký", screen: "journal" as const, searchText: Object.values(entry.data).flat().join(" ") })),
    ...state.inventory.map(instance => ITEMS.find(item => item.id === instance.definitionId)).filter(item => item !== undefined).map(item => ({ id: `item:${item.id}`, label: item.name, detail: "Trong túi đồ", screen: "inventory" as const })),
    ...FURNITURE.filter(item => (state.ownedFurniture[item.id] ?? 0) > 0).map(item => ({ id: `furniture:${item.id}`, label: item.name, detail: `Sở hữu ×${state.ownedFurniture[item.id]}`, screen: "furniture" as const })),
    ...(state.realLifeRewards ?? []).filter(reward => !reward.archived).map(reward => ({ id: `reward:${reward.id}`, label: reward.name, detail: `${reward.cost.toLocaleString("vi-VN")} G · Phần thưởng cá nhân`, screen: "rewards" as const })),
  ];
  return results.filter(result => normalizeLobbySearch(`${result.label} ${result.detail} ${result.searchText ?? ""}`).includes(query)).filter((result, index, array) => array.findIndex(candidate => candidate.id === result.id) === index).slice(0, 8);
}

const roomCategories: Record<LobbyRoom, readonly string[]> = {
  "Phòng khách": ["seating", "decor", "electronics", "light"],
  "Phòng ngủ": ["bed", "storage"],
  "Góc làm việc": ["desk", "chair", "workshop"],
  "Nhà bếp": ["kitchen"],
  "Ban công": ["plant", "decoration", "collectible", "decor"],
};
const roomIds: Record<LobbyRoom, readonly string[]> = {
  "Phòng khách": ["living", "lounge", "Phòng khách"],
  "Phòng ngủ": ["bedroom", "bed", "Phòng ngủ"],
  "Góc làm việc": ["office", "study", "workspace", "Góc làm việc"],
  "Nhà bếp": ["kitchen", "Nhà bếp"],
  "Ban công": ["balcony", "terrace", "Ban công"],
};

export function lobbyRoomFurniture(state: GameState, room: LobbyRoom): string[] {
  return lobbyPlacedFurniture(state, room).map(item => item.name);
}

export type LobbyPlacedFurniture = { id: string; name: string; category: string; x: number; z: number; rotation: number };

/** Projects the saved apartment plan into the lobby without inventing fixture items. */
export function lobbyPlacedFurniture(state: GameState, room?: LobbyRoom): LobbyPlacedFurniture[] {
  const placed = state.building?.plan.furniture ?? state.placements;
  return placed.flatMap(placement => {
    const item = FURNITURE.find(candidate => candidate.id === placement.furnitureId);
    const roomId = "roomId" in placement ? placement.roomId : undefined;
    const matchesRoom = !room || (roomId && roomIds[room].includes(roomId)) || (!roomId && roomCategories[room].includes(item?.category ?? ""));
    return item && matchesRoom ? [{ id: placement.id, name: item.name, category: item.category, x: placement.x, z: placement.z, rotation: placement.rotation }] : [];
  });
}

export function lobbyPriorityTasks(tasks: Task[], open: GameState["occurrences"]): Task[] {
  const openIds = new Set(open.map(item => item.taskId));
  const rank = { high: 0, normal: 1, low: 2 };
  return tasks.filter(task => !task.archived && openIds.has(task.id)).sort((a, b) => rank[a.priority] - rank[b.priority] || a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
}
