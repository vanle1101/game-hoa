"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import * as THREE from "three";
import { LEVEL_HEIGHT } from "@/construction/catalog";
import type { BuildingPlan, Plot } from "@/construction/types";
import type { RoomBounds } from "./architectural-materials";
import { computeV9ApartmentCameraFraming } from "./v9-framing";
import { isLiveTypingTarget, liveControlsBlocked } from "./live-movement";
import { cameraRelativePan, lockOrbitTargetY, translateOrbitRig, characterCameraPreset, isCharacterCameraPreset, orbitCharacterCamera, followViewDirection, type CharacterCameraPreset } from "./camera-geometry";
import { residenceElevation, RESIDENTIAL_FLOOR_HEIGHT, RESIDENTIAL_FLOORS } from "./building-architecture";
import { WORLD_VIEWS, worldViewPose, type WorldView } from './world-views';

export type DesktopCameraMode = "follow" | "free" | "build";
type ShowcaseFocus = "benchmark" | "lobby" | "bed" | "sofa" | "desk" | "kitchen" | "window";
type Props = {
  mode: "live" | "build" | "buy";
  cameraMode?: DesktopCameraMode;
  onCameraModeChange?: (mode: DesktopCameraMode) => void;
  reset?: number;
  level: number;
  plot: Plot;
  roomBounds: RoomBounds;
  plan: BuildingPlan;
  avatar: RefObject<{ x: number; z: number }>;
  enclosed?: boolean;
  referenceScene?: boolean;
  /** World-scale volumes supplied by the host for skyline and building occlusion. */
  worldColliders?: readonly THREE.Box3[];
};

export function DesktopCamera(props: Props) {
  const { onCameraModeChange } = props;
  const { camera, gl, size, scene } = useThree();
  // R3F's camera is intentionally mutated by the imperative camera rig. Store
  // it in a ref to keep those updates out of React's render immutability path.
  const cameraRef = useRef(camera);
  const orbit = useRef<OrbitControlsType>(null);
  const [localMode, setLocalMode] = useState<DesktopCameraMode>("follow");
  const active = props.mode === "live" ? (props.cameraMode ?? localMode) : "build";
  // Home opens on the apartment-facing inspection angle so the player sees
  // the room and avatar immediately.  The explicit "Sau lưng" preset remains
  // available for the classic gameplay view.
  const state = useRef(characterCameraPreset("front"));
  const resetVersion = useRef(props.reset);
  const framedMode = useRef<DesktopCameraMode | undefined>(undefined);
  const pendingWorldView = useRef<WorldView | undefined>(undefined);
  const pendingShowcaseFocus = useRef<ShowcaseFocus | undefined>(undefined);
  const renderedAvatar = useRef<THREE.Object3D | undefined>(undefined);
  const panKeys = useRef(new Set<string>());
  const panVelocity = useRef(new THREE.Vector3());
  const lastPanLog = useRef(0);
  const orbitTargetY = useRef<number | undefined>(undefined);
  const vectors = useMemo(() => ({ anchor: new THREE.Vector3(), direction: new THREE.Vector3(),
    desired: new THREE.Vector3(), look: new THREE.Vector3(), delta: new THREE.Vector3() }), []);
  const sizeRef = useRef(size);
  useEffect(() => { sizeRef.current = size; }, [size]);

  const changeMode = useCallback((next: DesktopCameraMode) => {
    setLocalMode(next);
    onCameraModeChange?.(next);
  }, [onCameraModeChange]);

  const applyCharacterPreset = useCallback((preset: CharacterCameraPreset) => {
    const avatarObject = scene.getObjectByName("life-level-avatar");
    renderedAvatar.current = avatarObject;
    state.current = characterCameraPreset(preset, avatarObject?.rotation.y ?? 0);
  }, [scene]);

  const resetCamera = useCallback(() => {
    const activeCamera = cameraRef.current;
    if (activeCamera instanceof THREE.PerspectiveCamera) {
      // Wider inspection lens keeps the full floor plate and panorama in frame.
      activeCamera.fov = active === "follow" ? 58 : props.referenceScene && active === "free" ? 32 : 43;
      activeCamera.near = 0.04;
      activeCamera.far = 1800;
      activeCamera.updateProjectionMatrix();
    }
    if (active === "follow") {
      applyCharacterPreset("front");
      return;
    }
    // Do not rely on the host's one-shot benchmark event. On a cold load the
    // event can arrive before this rig subscribes, leaving Home on the old
    // close crop. Live Home and the read-only fixture intentionally share the
    // same architectural inspection pose.
    if (active === "free" && props.mode === "live") {
      const pose = showcaseFocusPose("benchmark");
      activeCamera.position.set(...pose.position);
      activeCamera.lookAt(new THREE.Vector3(...pose.target));
      orbit.current?.target.set(...pose.target);
      orbitTargetY.current = pose.target[1];
      orbit.current?.update();
      return;
    }
    const framing = computeV9ApartmentCameraFraming({ mode: props.mode, plot: props.plot,
      roomBounds: props.roomBounds, level: props.level,
      aspect: sizeRef.current.width / Math.max(1, sizeRef.current.height) });
    activeCamera.position.copy(framing.position);
    activeCamera.lookAt(framing.target);
    orbit.current?.target.copy(framing.target);
    orbitTargetY.current = framing.target.y;
    orbit.current?.update();
  }, [active, props.mode, props.plot, props.roomBounds, props.level, props.referenceScene, applyCharacterPreset]);
  // Draft edits replace roomBounds, but they must never reframe the player's
  // orbit. Frame once per camera mode, or on an explicit Reset button press.
  useEffect(() => {
    if (framedMode.current !== active || resetVersion.current !== props.reset) resetCamera();
    framedMode.current = active;
    resetVersion.current = props.reset;
  }, [props.reset, active, resetCamera]);
  useEffect(() => {
    const activeCamera = cameraRef.current;
    if (!(activeCamera instanceof THREE.PerspectiveCamera)) return;
    activeCamera.fov = active === "follow" ? 58 : props.referenceScene && active === "free" ? 32 : 43;
    activeCamera.near = .04;
    activeCamera.far = 1800;
    activeCamera.updateProjectionMatrix();
  }, [active, props.referenceScene]);

  useEffect(() => {
    const canvas = gl.domElement;
    let pointer: number | undefined;
    const allowed = () => !liveControlsBlocked(document, { enabled: true });
    const panCodes = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"]);
    const key = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.isComposing ||
        event.defaultPrevented || isLiveTypingTarget(event.target) || !allowed()) return;
      if (event.code === "KeyV" && props.mode === "live") {
        event.preventDefault(); changeMode(active === "follow" ? "free" : "follow");
      } else if (event.code === "KeyI" && props.mode === "live") {
        event.preventDefault(); applyCharacterPreset("front"); changeMode("follow");
      } else if (event.code === "Home") {
        event.preventDefault(); resetCamera();
      } else if (event.code === "KeyF") {
        event.preventDefault();
        if (active === "follow") {
          // Refocus the full figure while retaining the user's orbit angle.
          state.current.targetHeight = 1.1;
          state.current.distance = 3.6;
          return;
        }
        const controls = orbit.current;
        if (!controls) return;
        vectors.delta.set(props.avatar.current.x, props.level * LEVEL_HEIGHT + 1.2, props.avatar.current.z).sub(controls.target);
        controls.target.add(vectors.delta); cameraRef.current.position.add(vectors.delta); controls.update();
      }
    };
    const panDown = (event: KeyboardEvent) => {
      if (active === "follow" || !allowed() || isLiveTypingTarget(event.target) || event.ctrlKey || event.altKey || event.metaKey) return;
      if (!panCodes.has(event.code)) return;
      event.preventDefault();
      panKeys.current.add(event.code);
    };
    const panUp = (event: KeyboardEvent) => {
      if (panCodes.has(event.code)) panKeys.current.delete(event.code);
    };
    const clearPan = () => panKeys.current.clear();
    const down = (event: PointerEvent) => {
      if (active !== "follow" || event.button !== 2 || !allowed()) return;
      pointer = event.pointerId; canvas.setPointerCapture(pointer); event.preventDefault();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer || !allowed()) return;
      state.current = orbitCharacterCamera(state.current, event.movementX, event.movementY);
    };
    const release = () => {
      if (pointer !== undefined && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
      pointer = undefined;
    };
    const wheel = (event: WheelEvent) => {
      if (active !== "follow" || !allowed()) return;
      event.preventDefault();
      state.current.distance = THREE.MathUtils.clamp(state.current.distance * Math.exp(event.deltaY * 0.001), 0.6, 7);
    };
    const context = (event: Event) => event.preventDefault();
    const preset = (event: Event) => {
      const value = (event as CustomEvent<{ preset?: unknown }>).detail?.preset;
      if (props.mode !== "live" || !allowed() || !isCharacterCameraPreset(value)) return;
      applyCharacterPreset(value); changeMode("follow");
    };
    window.addEventListener("life-level:camera-preset", preset);
    const worldView = (event:Event) => {
      const view=(event as CustomEvent<{view:WorldView}>).detail?.view;
      if(props.mode!=="live" || !WORLD_VIEWS.some(([id])=>id===view))return;
      pendingWorldView.current=view;changeMode('free');
    };
    const showcaseFocus = (event: Event) => {
      const focus = (event as CustomEvent<{ focus?: unknown }>).detail?.focus;
      if (props.mode !== "live" || active !== "free") return;
      if (!["benchmark", "lobby", "bed", "sofa", "desk", "kitchen", "window"].includes(String(focus))) return;
      pendingShowcaseFocus.current = focus as ShowcaseFocus;
    };
    window.addEventListener('life-level:world-view',worldView);
    window.addEventListener("life-level:showcase-focus", showcaseFocus);
    window.addEventListener("keydown", key);
    window.addEventListener("keydown", panDown);
    window.addEventListener("keyup", panUp);
    window.addEventListener("blur", release);
    window.addEventListener("blur", clearPan);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("contextmenu", context);
    return () => {
      release(); panKeys.current.clear(); window.removeEventListener("keydown", key); window.removeEventListener("keydown", panDown); window.removeEventListener("keyup", panUp); window.removeEventListener("blur", release); window.removeEventListener("blur", clearPan);
      window.removeEventListener("life-level:camera-preset", preset);
      window.removeEventListener('life-level:world-view',worldView);
      window.removeEventListener("life-level:showcase-focus", showcaseFocus);
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", release); canvas.removeEventListener("pointercancel", release);
      canvas.removeEventListener("wheel", wheel); canvas.removeEventListener("contextmenu", context);
    };
  }, [active, gl, props.mode, props.avatar, props.level, changeMode, resetCamera, vectors, applyCharacterPreset]);

  useFrame((_, dt) => {
    const activeCamera = cameraRef.current;
    canvasDataset(gl.domElement, active);
    activeCamera.userData.desktopCameraMode = active;
    if (active !== "follow") {
      // OrbitControls has no mesh collision. Keep this rig free of the old
      // camera-boom sweeps: those moved the camera/target on rotation and felt
      // like a sudden automatic zoom near the shell or ceiling.
      const controls = orbit.current;
      if (controls) {
        const keys = panKeys.current;
        const inputX = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
        const inputForward = (keys.has("ArrowUp") || keys.has("KeyW") ? 1 : 0) - (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0);
        const speed = active === "build" ? 7.5 : 12;
        const targetVelocity = cameraRelativePan(activeCamera, inputForward, inputX, vectors.direction).multiplyScalar(speed);
        panVelocity.current.lerp(targetVelocity, 1 - Math.exp(-12 * Math.min(dt, 0.1)));
        if (panVelocity.current.lengthSq() > 0.000001) {
          const delta = vectors.desired.copy(panVelocity.current).multiplyScalar(Math.min(dt, 0.1));
          const distanceBefore = activeCamera.position.distanceTo(controls.target);
          translateOrbitRig(activeCamera, controls.target, delta);
          const distanceAfter = activeCamera.position.distanceTo(controls.target);
          activeCamera.userData.panDebug = {
            delta: delta.toArray(), target: controls.target.toArray(),
            camera: activeCamera.position.toArray(), distanceBefore, distanceAfter,
          };
          if (process.env.NODE_ENV === "development" && performance.now() - lastPanLog.current > 1000) {
            console.debug("[camera-pan] target and camera moved together", activeCamera.userData.panDebug);
            lastPanLog.current = performance.now();
          }
        }
        if (pendingShowcaseFocus.current) {
          const focus = pendingShowcaseFocus.current;
          pendingShowcaseFocus.current = undefined;
          const pose = showcaseFocusPose(focus);
          activeCamera.position.set(...pose.position);
          controls.target.set(...pose.target);
          orbitTargetY.current = pose.target[1];
          activeCamera.lookAt(controls.target);
        }
        if(pendingWorldView.current){
          const building=scene.getObjectByName('residential-building');
          const floor=(building?.userData.residenceFloor??8) as 8|16|24;
          const pose=worldViewPose(pendingWorldView.current,-residenceElevation(floor));
          activeCamera.position.set(...pose.position);controls.target.set(...pose.target);
          orbitTargetY.current = pose.target[1];
          activeCamera.lookAt(controls.target);pendingWorldView.current=undefined;
        }
        const target = controls.target;
        const building = scene.getObjectByName("residential-building");
        const floor = (building?.userData.residenceFloor ?? 16) as 8 | 16 | 24;
        const ground = -residenceElevation(floor);
        const roof = RESIDENTIAL_FLOORS * RESIDENTIAL_FLOOR_HEIGHT + ground;
        const centerX = (props.plot.minX + props.plot.maxX) / 2;
        const centerZ = (props.plot.minZ + props.plot.maxZ) / 2;
        if (orbitTargetY.current === undefined) orbitTargetY.current = target.y;
        const targetBefore = vectors.look.copy(target);
        const targetAfter = vectors.direction.copy(targetBefore);
        targetAfter.x = THREE.MathUtils.clamp(targetAfter.x, centerX - 180, centerX + 180);
        targetAfter.z = THREE.MathUtils.clamp(targetAfter.z, centerZ - 180, centerZ + 180);
        targetAfter.y = THREE.MathUtils.clamp(targetAfter.y, ground + .35, roof + 120);
        translateOrbitRig(activeCamera, target, vectors.delta.subVectors(targetAfter, targetBefore));
        lockOrbitTargetY(activeCamera, target, orbitTargetY.current);
        // OrbitControls owns its spherical cache. Update once after every
        // external translation so mouse rotation never accumulates a stale
        // offset and inflates the orbit radius.
        controls.update();
      }
      return;
    }
    const rig = state.current;
    if (!renderedAvatar.current?.parent) renderedAvatar.current = scene.getObjectByName("life-level-avatar");
    const avatarObject = renderedAvatar.current;
    if (avatarObject) {
      // Read the rendered transform after Avatar's -1 update. This also follows
      // jumping, seated and lying poses without changing their rotation.
      avatarObject.updateWorldMatrix(true, false);
      vectors.anchor.set(0, rig.targetHeight, 0).applyMatrix4(avatarObject.matrixWorld);
    } else vectors.anchor.set(props.avatar.current.x, props.level * LEVEL_HEIGHT + rig.targetHeight, props.avatar.current.z);
    followViewDirection(rig.yaw, rig.pitch, vectors.direction);
    vectors.desired.copy(vectors.anchor).addScaledVector(vectors.direction, -rig.distance);
    // The follow camera also used to retract against wall/floor/furniture
    // boxes. Respect only the player's requested zoom while orbiting indoors.
    rig.actualDistance = rig.distance;
    activeCamera.position.copy(vectors.anchor).addScaledVector(vectors.direction, -rig.actualDistance);
    vectors.look.copy(activeCamera.position).add(vectors.direction);
    activeCamera.lookAt(vectors.look);
    // Runtime QA can inspect the actual rig without touching player state.
    activeCamera.userData.followOrbit = { yaw: rig.yaw, pitch: rig.pitch, distance: rig.actualDistance };
    gl.domElement.dataset.avatarHeading = avatarObject ? String(avatarObject.rotation.y) : "missing";
    gl.domElement.dataset.followYaw = String(rig.yaw);
  });

  if (active === "follow") return null;
  return <OrbitControls ref={orbit} makeDefault enableDamping dampingFactor={0.05}
    minDistance={active === "build" ? 5 : 3} maxDistance={active === "build" ? 25 : 240}
    minPolarAngle={0.025} maxPolarAngle={active === "build" ? Math.PI / 2 - 0.05 : Math.PI - 0.025}
    mouseButtons={{ LEFT: -1 as typeof THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }} />;
}

function showcaseFocusPose(focus: ShowcaseFocus): { position: [number, number, number]; target: [number, number, number] } {
  switch (focus) {
    case "lobby": return { position: [4.5, 2.8, 4.5], target: [0, .9, .2] };
    case "bed": return { position: [-1.2, 4.3, 0.4], target: [-2.8, .75, -3.25] };
    case "sofa": return { position: [.7, 4.3, 5.8], target: [.5, .65, 1.2] };
    case "desk": return { position: [7.2, 3.9, .5], target: [3.7, .75, -3.85] };
    case "kitchen": return { position: [-4.0, 4.1, 5.0], target: [-3.5, .7, .75] };
    case "window": return { position: [1, 1.67, -2.8], target: [75, -3, -100] };
    case "benchmark":
    // Three-quarter view aimed through the north glazing.  This keeps the
    // interior dominant while leaving space for the harbor skyline above it.
    // Reference-locked interior composition: the camera sits high enough to
    // read the walnut floor, kitchen island, bed wall, desk and bathroom in one
    // three-quarter frame while preserving the live character in the room.
    default: return { position: [10.3, 8.4, 15.2], target: [0.1, 0.62, -0.7] };
  }
}

function canvasDataset(canvas: HTMLCanvasElement, mode: DesktopCameraMode) {
  if (canvas.dataset.cameraMode !== mode) canvas.dataset.cameraMode = mode;
}
