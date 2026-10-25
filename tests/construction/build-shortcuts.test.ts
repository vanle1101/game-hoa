import { describe, expect, it } from "vitest";
import { buildShortcut } from "../../src/components/construction/build-shortcuts";

const key = (code: string, displayedKey = code, extras: Partial<KeyboardEvent> = {}) =>
  ({ code, key: displayedKey, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, ...extras }) as KeyboardEvent;

describe("Build Mode physical-key shortcuts", () => {
  it.each(["KeyW", "KeyA", "KeyS", "KeyD"])("never edits the draft for %s under Vietnamese IME", code => {
    expect(buildShortcut(key(code, "ư"), true)).toBeUndefined();
    expect(buildShortcut(key(code, "ư", { isComposing: true }), true)).toBeUndefined();
  });
  it("uses code for editing shortcuts and suppresses them during composition", () => {
    expect(buildShortcut(key("KeyR", "r"), true)).toBe("rotate");
    expect(buildShortcut(key("KeyZ", "z", { ctrlKey: true }), true)).toBe("undo");
    expect(buildShortcut(key("KeyZ", "z", { ctrlKey: true, isComposing: true }), true)).toBeUndefined();
    expect(buildShortcut(key("Delete", "Delete"), true)).toBe("delete");
  });
});
