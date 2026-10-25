import { describe, expect, it } from "vitest";
import { createInitialState } from "../../src/domain/engine";
import { lobbyPlacedFurniture, lobbyPriorityTasks, lobbyRoomFurniture, lobbySearch } from "../../src/components/game/lobby-data";
import type { Task } from "../../src/domain/types";

describe("lobby backend projections", () => {
  it("searches live save content without exposing archived rewards or tasks", () => {
    const state = createInitialState("lobby-test");
    const task: Task = { id: "task-1", title: "Đọc sách buổi tối", description: "Ghi chú nghiên cứu", kind: "daily", difficulty: "easy", skill: "knowledge", duration: 20, priority: "high", dueDate: "2026-10-19", timezone: "Asia/Ho_Chi_Minh", committed: false, checklist: [], archived: false, createdAt: "2026-10-19T00:00:00Z", exceptions: [] };
    state.tasks = [task, { ...task, id: "task-archived", title: "Việc đã ẩn", archived: true }];
    state.realLifeRewards = [{ id: "reward-1", name: "Một buổi đọc sách", description: "", cost: 50, redemptions: 0, archived: false }, { id: "reward-archived", name: "Phần thưởng cũ", description: "", cost: 30, redemptions: 0, archived: true }];
    state.ownedFurniture["cloud-bed"] = 1;
    state.journal = [{ id: "event-1", type: "note", title: "Buổi sáng", at: "2026-10-19T00:00:00Z", data: { note: "Uống nước" } }];

    expect(lobbySearch(state, "doc sach").map(item => item.screen)).toContain("quests");
    expect(lobbySearch(state, "ghi chu").some(item => item.id === "task:task-1")).toBe(true);
    expect(lobbySearch(state, "uống nước").some(item => item.id === "journal:event-1")).toBe(true);
    expect(lobbySearch(state, "giường đôi").some(item => item.id === "furniture:cloud-bed")).toBe(true);
    expect(lobbySearch(state, "một buổi đọc sách").some(item => item.id === "reward:reward-1")).toBe(true);
    expect(lobbySearch(state, "việc đã ẩn")).toEqual([]);
    expect(lobbySearch(state, "phần thưởng cũ")).toEqual([]);
  });

  it("reads placed furniture from the saved building and orders open tasks by priority", () => {
    const state = createInitialState("lobby-test");
    state.building = { version: 1, revision: 1, plot: { minX: -8, maxX: 8, minZ: -8, maxZ: 8, maxLevel: 0, cellSize: 1 }, plan: { floors: [], walls: [], furniture: [{ id: "bed", furnitureId: "cloud-bed", x: 0, z: 0, level: 0, rotation: 0 }, { id: "desk", furnitureId: "workstation", x: 2, z: 0, level: 0, rotation: 0 }], stairs: [], ceilings: [], roofs: [], roomNames: {} }, paid: {}, starterGrantApplied: true, migratedAt: "2026-10-19T00:00:00Z", legacyPlacementsPreserved: false };
    expect(lobbyRoomFurniture(state, "Phòng ngủ")).toEqual(["Giường đôi bọc nệm cao cấp"]);
    expect(lobbyRoomFurniture(state, "Góc làm việc")).toEqual(["Bàn làm việc Cyberpunk LED"]);
    expect(lobbyRoomFurniture(state, "Nhà bếp")).toEqual([]);
    expect(lobbyPlacedFurniture(state, "Phòng ngủ").map(item => item.id)).toEqual(["bed"]);

    const base: Task = { id: "normal", title: "Bình thường", description: "", kind: "once", difficulty: "easy", skill: "health", duration: 10, priority: "normal", dueDate: "2026-10-19", timezone: "Asia/Ho_Chi_Minh", committed: false, checklist: [], archived: false, createdAt: "2026-10-19T00:00:00Z", exceptions: [] };
    const tasks = [base, { ...base, id: "high", title: "Ưu tiên", priority: "high" as const }, { ...base, id: "closed", title: "Đã xong", priority: "high" as const }];
    const open = ["normal", "high"].map(id => ({ id: `${id}-occurrence`, taskId: id, date: "2026-10-19", status: "open" as const }));
    expect(lobbyPriorityTasks(tasks, open).map(task => task.id)).toEqual(["high", "normal"]);
  });
});
