"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CharacterModel } from "@/components/world/CharacterModel";
import type { GameState } from "@/domain/types";
import type { CharacterRenderProfile } from "./character-render-profile";
import { useCharacterIdentity } from "./character-identity-store";
import { clearLegacyPortrait, migrateLegacyPortrait, readServerPortrait, saveServerPortrait } from "./portrait-client";

function Capture({ render, onCaptured, onFailed }: { render: CharacterRenderProfile; onCaptured: (dataUrl: string) => void; onFailed: () => void }) {
  const { gl } = useThree();
  const [done, setDone] = useState(false);
  const [frames, setFrames] = useState(0);
  useFrame(() => {
    if (done) return;
    if (frames < 2) { setFrames(frames + 1); return; }
    try {
      const avatarUrl = gl.domElement.toDataURL("image/png");
      if (avatarUrl.length > 100) onCaptured(avatarUrl);
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
  const [captureReady, setCaptureReady] = useState(false);
  const portraitKey = identity?.portraitKey ?? "";
  const identityOwnerId = identity?.ownerId;
  const hasPortrait = Boolean(identity?.avatarUrl);
  const ownerId = state.userId;
  useEffect(() => {
    if (identityOwnerId !== ownerId || hasPortrait) return;
    let cancelled = false;
    void (async () => {
      try {
        const saved = await readServerPortrait(ownerId, portraitKey);
        if (cancelled) return;
        if (saved) {
          clearLegacyPortrait(ownerId, portraitKey);
          useCharacterIdentity.getState().setPortrait(ownerId, portraitKey, saved);
          return;
        }
        const migrated = await migrateLegacyPortrait(ownerId, portraitKey);
        if (cancelled) return;
        if (migrated) useCharacterIdentity.getState().setPortrait(ownerId, portraitKey, migrated);
        else setCaptureReady(true);
      } catch { if (!cancelled) setFailed(true); }
    })();
    return () => { cancelled = true; };
  }, [identityOwnerId, hasPortrait, ownerId, portraitKey]);
  if (failed || !captureReady || !identity || identity.ownerId !== state.userId || identity.portraitKey !== portraitKey || identity.avatarUrl) return null;
  const onCaptured = (dataUrl: string) => {
    void saveServerPortrait(ownerId, portraitKey, dataUrl).then(() => {
      useCharacterIdentity.getState().setPortrait(ownerId, portraitKey, dataUrl);
    }).catch(() => setFailed(true));
  };
  return <PortraitBoundary><div className="character-portrait-capture" aria-hidden="true">
    <Canvas dpr={1} camera={{ position: [0, 1.58, -1.45], fov: 26 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.55, 0)}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "low-power" }}>
      <Capture render={identity.render} onCaptured={onCaptured} onFailed={() => setFailed(true)} />
    </Canvas>
  </div></PortraitBoundary>;
}
