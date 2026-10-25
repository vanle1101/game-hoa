"use client";

import { EquipmentModel, type EquipmentModelProps } from "./equipment-models";

export type WeaponModelProps = Omit<EquipmentModelProps, "itemId" | "id"> & { id?: string; itemId?: string };

/** Shared weapon geometry: grip at origin, blade extends +Y; same mesh in hand and showcase. */
export default function WeaponModel({ id = "starter-blade", itemId, ...props }: WeaponModelProps) {
  return <EquipmentModel itemId={itemId ?? id} {...props} />;
}
