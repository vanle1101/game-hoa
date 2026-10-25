"use client";

import { useCharacterIdentity } from "./character-identity-store";
import Image from "next/image";

export default function CharacterAvatar({ className = "", ownerId, fallbackName = "" }: { className?: string; ownerId: string; fallbackName?: string }) {
  const identity = useCharacterIdentity((store) => store.identity);
  const current = identity?.ownerId === ownerId ? identity : null;
  return <span className={`character-avatar ${className}`} aria-hidden="true">
    {current?.avatarUrl
      ? <Image src={current.avatarUrl} alt="" width={96} height={96} unoptimized />
      : <span>{(current?.name || fallbackName).trim().charAt(0).toUpperCase() || "?"}</span>}
  </span>;
}
