/** Production assets are isolated from player ownership and the paid catalog. */
/** Compatibility bridge: the showcase now uses the same V21 registry as Home. */
import { APARTMENT_ASSETS } from "@/components/apartment-v21/asset-registry";
export type AssetId = Exclude<keyof typeof APARTMENT_ASSETS, "rug">;
export const assets = APARTMENT_ASSETS as Omit<typeof APARTMENT_ASSETS, "rug">;
