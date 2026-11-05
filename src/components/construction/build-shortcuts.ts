import { CAMERA_PAN_CODES } from "./input-codes";

export type BuildShortcut = "undo" | "redo" | "rotate" | "cancel" | "stash" | "delete" | "select" | "room" | "door" | "window" | "paint" | "curve" | "move";
const toolShortcuts: Partial<Record<string, BuildShortcut>> = { KeyQ: "select", KeyE: "room", KeyT: "door", KeyY: "window", KeyU: "paint", KeyC: "curve", KeyM: "move" };

/** Physical key codes are stable when a Vietnamese IME rewrites event.key. */
export function buildShortcut(event: Pick<KeyboardEvent, "code" | "ctrlKey" | "metaKey" | "altKey" | "isComposing">, buildMode: boolean): BuildShortcut | undefined {
  if (event.isComposing || event.altKey) return undefined;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier) return event.code === "KeyZ" ? "undo" : event.code === "KeyY" ? "redo" : undefined;
  if (CAMERA_PAN_CODES.has(event.code) || ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) return undefined;
  if (event.code === "KeyR") return "rotate";
  if (event.code === "Escape") return "cancel";
  if (event.code === "KeyX") return "stash";
  if (event.code === "Delete" || event.code === "Backspace") return "delete";
  if (!buildMode) return undefined;
  return toolShortcuts[event.code];
}
