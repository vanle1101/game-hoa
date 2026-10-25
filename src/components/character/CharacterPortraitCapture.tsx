"use client";

import { Component, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CharacterModel } from "@/components/world/CharacterModel";
import type { GameState } from "@/domain/types";
import type { CharacterRenderProfile } from "./character-render-profile";
import { useCharacterIdentity } from "./character-identity-store";

function Capture({ state, portraitKey, render, onFailed }: { state: GameState; portraitKey: string; render: CharacterRenderProfile; onFailed: () => void }) {
  const { gl } = useThree();
  const setPortrait = useCharacterIdentity((store) => store.setPortrait);
  const [done, setDone] = useState(false);
  const [frames, setFrames] = useState(0);
  useFrame(() => {
    if (done) return;
    if (frames < 2) { setFrames(frames + 1); return; }
    try {
      const avatarUrl = gl.domElement.toDataURL("image/png");
      if (avatarUrl.length > 100) setPortrait(state.userId, portraitKey, avatarUrl);
      else onFailed();
    } catch { onFailed(); }
    setDone(true);
  });
  return <>
    <ambientLight color="#c7d7ef" intensity={1.4} />
    <directionalLight position={[-2, 4, -3]} color="#ffe0c4" intensity={3} />
    <pointLight position={[2, 1.5, -2]} color="#d34aff" intensity={4} />
    <group rotation={[0, Math.PI, 0]}>
      <CharacterModel character={{ ...render.character, cosmetics: render.cosmetics }}
        equipment={render.equipment} paused weaponDrawn={false} referenceLook={render.referenceLook} />
    </group>
  </>;
}

class PortraitBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function CharacterPortraitCapture({ state }: { state: GameState }) {
  const identity = useCharacterIdentity((store) => store.identity);
  const [failed, setFailed] = useState(false);
  const portraitKey = identity?.portraitKey ?? "";
  if (failed || !identity || identity.ownerId !== state.userId || identity.portraitKey !== portraitKey || identity.avatarUrl) return null;
  return <PortraitBoundary><div className="character-portrait-capture" aria-hidden="true">
    <Canvas dpr={1} camera={{ position: [0, 1.58, -1.45], fov: 26 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.55, 0)}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "low-power" }}>
      <Capture state={state} portraitKey={portraitKey} render={identity.render} onFailed={() => setFailed(true)} />
    </Canvas>
  </div></PortraitBoundary>;
}
