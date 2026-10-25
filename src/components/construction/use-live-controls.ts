"use client";

import { useEffect, useMemo, useRef, type CSSProperties, type HTMLAttributes } from "react";
import {
  bindLiveControlListeners,
  createLiveInputController,
  liveControlsBlocked,
  type LiveControlGate,
  type LiveDirection,
  type LiveInput,
} from "./live-movement";

export type UseLiveControlsOptions = LiveControlGate & { onStart?: () => void };
export type LiveDPadProps = Pick<HTMLAttributes<HTMLButtonElement>,
  "onPointerDown" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture" | "onContextMenu" | "onKeyDown" | "onKeyUp" | "onBlur" | "style" | "aria-label">;
export type LiveControls = {
  sample: () => LiveInput;
  clear: () => void;
  isBlocked: () => boolean;
  getDPadProps: (direction: LiveDirection) => LiveDPadProps;
};
const DPAD_STYLE: CSSProperties = { touchAction: "none", userSelect: "none" };
const DIRECTION_LABELS: Record<LiveDirection, string> = {
  forward: "Move forward", backward: "Move backward", left: "Move left", right: "Move right",
};
const KEYBOARD_POINTER_IDS: Record<LiveDirection, number> = { forward: -1, backward: -2, left: -3, right: -4 };

export function useLiveControls(options: UseLiveControlsOptions): LiveControls {
  const latest = useRef(options);
  const controller = useMemo(() => createLiveInputController(), []);
  useEffect(() => {
    latest.current = options;
    controller.setOnStart(options.onStart);
  });
  useEffect(() => {
    if (!options.enabled || options.blocked) controller.clear();
  }, [controller, options.enabled, options.blocked]);
  useEffect(() => bindLiveControlListeners(window, document, controller, () => latest.current), [controller]);

  return useMemo(() => {
    const blocked = () => typeof document === "undefined" || liveControlsBlocked(document, latest.current);
    return {
      sample: () => {
        if (blocked()) { controller.clear(); return { forward: 0, right: 0 }; }
        return controller.sample();
      },
      clear: controller.clear,
      isBlocked: blocked,
      getDPadProps: (direction: LiveDirection): LiveDPadProps => ({
        "aria-label": DIRECTION_LABELS[direction],
        style: DPAD_STYLE,
        onPointerDown: event => {
          if (blocked() || (event.pointerType === "mouse" && event.button !== 0)) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          controller.pressPointer(event.pointerId, direction);
        },
        onPointerUp: event => {
          event.preventDefault();
          event.stopPropagation();
          controller.releasePointer(event.pointerId);
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        },
        onPointerCancel: event => controller.releasePointer(event.pointerId),
        onLostPointerCapture: event => controller.releasePointer(event.pointerId),
        onContextMenu: event => event.preventDefault(),
        onKeyDown: event => {
          if ((event.code !== "Space" && event.code !== "Enter") || blocked()) return;
          event.preventDefault();
          controller.pressPointer(KEYBOARD_POINTER_IDS[direction], direction);
        },
        onKeyUp: event => {
          if (event.code !== "Space" && event.code !== "Enter") return;
          event.preventDefault();
          controller.releasePointer(KEYBOARD_POINTER_IDS[direction]);
        },
        onBlur: () => controller.releasePointer(KEYBOARD_POINTER_IDS[direction]),
      }),
    };
  }, [controller]);
}
