import type { EditorTool } from "./draft";
import { pushDraft, type DraftHistory } from "./draft";
import { furnitureSubtree, withoutFurnitureTree } from "@/construction/lot-objects";
import type { BuildingPlan } from "@/construction/types";

export type FurnitureMoveSession = {
  originalHistory: DraftHistory;
  originalItem: BuildingPlan["furniture"][number];
  children: BuildingPlan["furniture"];
  preview: BuildingPlan;
};

export function beginFurnitureMove(history: DraftHistory, id: string): FurnitureMoveSession | undefined {
  const originalItem = history.present.furniture.find(item => item.id === id);
  if (!originalItem) return undefined;
  return {
    originalHistory: history,
    originalItem,
    children: furnitureSubtree(history.present, id).slice(1),
    preview: withoutFurnitureTree(history.present, id),
  };
}

export function finishFurnitureMove(session: FurnitureMoveSession, plan: BuildingPlan): DraftHistory {
  return pushDraft(session.originalHistory, plan);
}

export function cancelFurnitureMove(session: FurnitureMoveSession): DraftHistory {
  return session.originalHistory;
}

/** Editing a placed item lifts its whole furniture tree into the cursor preview. */
export function furnitureSelectionIntent(tool: EditorTool, mode: "build" | "buy" | "live"): "select" | "pickup" | "sell" {
  if (mode === "live") return "select";
  if (tool === "erase") return "sell";
  return tool === "select" || tool === "move" || mode === "buy" ? "pickup" : "select";
}
