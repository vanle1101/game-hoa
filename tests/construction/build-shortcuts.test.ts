import { describe, expect, it } from "vitest";
import { buildShortcut } from "../../src/components/construction/build-shortcuts";
import { CAMERA_PAN_CODES } from "../../src/components/construction/input-codes";

const key = (code: string, displayedKey = code, extras: Partial<KeyboardEvent> = {}) =>
  ({ code, key: displayedKey, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, ...extras }) as KeyboardEvent;

describe("Build Mode physical-key shortcuts", () => {
  it("reserves exactly WASD for camera movement", () => {
    expect([...CAMERA_PAN_CODES]).toEqual(["KeyW", "KeyA", "KeyS", "KeyD"]);
  });
  it.each(["KeyW", "KeyA", "KeyS", "KeyD"])("never edits the draft for %s under Vietnamese IME", code => {
    let activeTool = "select";
    for (const displayedKey of ["w", "W", "ư", "Ư"]) {
      const action = buildShortcut(key(code, displayedKey), true);
      if (action) activeTool = action;
      expect(action).toBeUndefined();
      expect(activeTool).toBe("select");
    }
    expect(buildShortcut(key(code, "ư", { isComposing: true }), true)).toBeUndefined();
  });
  it("uses code for editing shortcuts and suppresses them during composition", () => {
    expect(buildShortcut(key("KeyR", "r"), true)).toBe("rotate");
    expect(buildShortcut(key("KeyZ", "z", { ctrlKey: true }), true)).toBe("undo");
    expect(buildShortcut(key("KeyZ", "z", { ctrlKey: true, isComposing: true }), true)).toBeUndefined();
    expect(buildShortcut(key("Delete", "Delete"), true)).toBe("delete");
  });
});
