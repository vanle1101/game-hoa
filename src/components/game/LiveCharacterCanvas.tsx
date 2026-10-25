"use client";

import { Canvas } from "@react-three/fiber";
import { memo } from "react";
import { CharacterModel, type ModelAppearance } from "../world/CharacterModel";

type Props = {
  skin?: string;
  outfit?: string;
  hair?: string;
  hairstyle?: string;
  appearance?: ModelAppearance;
  cosmetics?: Partial<Record<string, string>>;
  equipment?: Partial<Record<string, string>>;
  weaponId?: string;
  /** Show the saved avatar from the front for HUD/identity cards. */
  frontFacing?: boolean;
  referenceLook?: boolean;
};

/** Small real CharacterModel render used by the lobby; props come from the saved game state. */
function LiveCharacterCanvas({ skin, outfit, hair, hairstyle, appearance, cosmetics, equipment, weaponId, frontFacing = false, referenceLook = false }: Props) {
  const cameraPosition: [number, number, number] = [0, 1.05, frontFacing ? -3.8 : 3.8];
  return <Canvas dpr={[1, 1.25]} camera={{ position: cameraPosition, fov: 32 }} onCreated={({ camera }) => camera.lookAt(0, .85, 0)} gl={{ antialias: true, powerPreference: "high-performance" }}>
    <ambientLight intensity={1.35} color="#b9d8ff" />
    <directionalLight position={[-2, 4, 3]} intensity={2.1} color="#bce8ff" />
    <pointLight position={[1, 1.7, .1]} intensity={3.2} color="#ff3ed2" />
    <pointLight position={[-1, .8, .4]} intensity={2.4} color="#24c9ff" />
    <group position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
      <CharacterModel character={{ skin, outfit, hair, hairstyle, appearance, cosmetics }} equipment={equipment} weaponId={weaponId} weaponDrawn={false} paused referenceLook={referenceLook} />
    </group>
  </Canvas>;
}

export default memo(LiveCharacterCanvas);
