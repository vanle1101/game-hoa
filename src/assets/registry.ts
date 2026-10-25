import { COSMETICS } from "../character/catalog";
import { wearableGeometrySignature, wearableShape } from "../components/world/wearable-shapes";
import { BUILDING_CATALOG } from "../construction/catalog";
import { getDoorRecipe } from "../components/construction/door-models";
import { FURNITURE_CATALOG, furnitureGeometrySignature, getFurnitureRecipe } from "../furniture/catalog";
import { EQUIPMENT_CATALOG, getEquipmentRecipe } from "../equipment/catalog";
import type { BuildingCatalogItem } from "../construction/types";
import type { AssetFamily, AssetRecord, AssetRegistryIssue, AssetSourceReference } from "./types";
import { assetRecordIssues, hasRuntimeVerification } from "./coverage";

const source = (path: string, exportName: string, id: string): AssetSourceReference => ({ path, exportName, id });
const sourceEvidence = (reference: AssetSourceReference): AssetRecord["evidence"] => [{ kind: "source", reference: `${reference.path}#${reference.exportName}:${reference.id}`, result: "passed" }];
const normalizedCosmeticCategory = (slot: string) => ({ shoes: "shoe", outerwear: "outer", headwear: "head" }[slot] ?? slot);

function cosmeticRecords(): AssetRecord[] {
  return COSMETICS.map(item => {
    const reference = source("src/character/catalog.ts", "COSMETICS", item.id);
    const shape = wearableShape(item.model);
    return {
      id: item.assetId ?? `cosmetic.${item.id}`,
      name: item.name,
      family: "cosmetic",
      category: normalizedCosmeticCategory(item.slot),
      status: shape ? "INTEGRATING" : "BLOCKED",
      source: reference,
      geometry: shape ? { source: source("src/components/world/wearable-shapes.ts", "WEARABLE_SHAPES", item.model), signature: wearableGeometrySignature(item.model), primitiveCount: shape.parts.length } : undefined,
      materialSignature: JSON.stringify({ color: item.color, parts: shape?.parts.map(part => ({ colorRole: part.colorRole, metal: part.metal })) }),
      price: item.price,
      level: item.level,
      starter: item.starter === true,
      rarity: item.rarity,
      collection: item.collection,
      slot: item.slot,
      rigAnchors: shape ? [...new Set(shape.parts.map(part => part.anchor))] : undefined,
      evidence: sourceEvidence(reference),
      limitations: shape ? ["Runtime equip, clipping and visual acceptance are not verified."] : ["No matching wearable geometry recipe."],
    };
  });
}

function constructionFamily(item: BuildingCatalogItem): AssetFamily {
  if (item.category === "curve") return "curved-glass";
  if (item.category === "window") return "straight-glass";
  if (item.category === "door") return "door";
  if (["floor", "wall", "ceiling", "roof"].includes(item.category)) return "material";
  return "construction";
}

function constructionRecords(): AssetRecord[] {
  return BUILDING_CATALOG.map(item => {
    const reference = source("src/construction/catalog.ts", "BUILDING_CATALOG", item.id);
    const family = constructionFamily(item);
    const profile = item.curve;
    const door = family === "door" ? getDoorRecipe(item.id) : undefined;
    const signature = door ? door.geometrySignature : family === "curved-glass" && profile
      ? JSON.stringify({ recipe: "curve", radius: profile.radius, angle: profile.angle, thickness: profile.thickness, height: profile.height })
      : family === "door" || family === "straight-glass"
        ? JSON.stringify({ recipe: item.category, width: item.openingWidth, height: item.openingHeight, sill: family === "straight-glass" ? item.sill : undefined })
        : undefined;
    return {
      id: `construction.${item.id}`,
      name: item.name,
      family,
      category: item.category,
      status: family === "curved-glass" && !profile ? "BLOCKED" : "INTEGRATING",
      source: reference,
      geometry: signature ? { source: door ? source("src/components/construction/door-models.tsx", "getDoorRecipe", item.id) : reference, signature, ...(door ? { primitiveCount: door.partCount } : {}) } : undefined,
      materialSignature: JSON.stringify({ color: item.color, material: profile?.material, frame: profile?.frame }),
      price: item.price,
      level: item.level,
      evidence: sourceEvidence(reference),
      limitations: family === "material"
        ? ["Surface finish definition; not an independent geometry model.", "Runtime material appearance is not verified."]
        : ["Construction geometry count uses distinct catalog parameter recipes, not exported mesh topology.", "Runtime placement, collision and visual acceptance are not verified."],
    };
  });
}

function furnitureRecords(): AssetRecord[] {
  return FURNITURE_CATALOG.map(item => {
    const reference = source("src/furniture/catalog.ts", "FURNITURE_CATALOG", item.id);
    const recipe = getFurnitureRecipe(item.id);
    const signature = furnitureGeometrySignature(item.id);
    return {
      id: `furniture.${item.id}`, name: item.name, family: "furniture",
      category: item.category === "light" ? "lights" : item.category,
      status: recipe && signature ? "INTEGRATING" : "BLOCKED",
      source: reference,
      geometry: recipe && signature ? { source: source("src/furniture/catalog.ts", "getFurnitureRecipe", item.id), signature, primitiveCount: recipe.parts.length } : undefined,
      materialSignature: JSON.stringify({ color: item.color, materials: recipe?.parts.map(part => part.material) }),
      price: item.price, level: item.level,
      evidence: sourceEvidence(reference),
      limitations: ["Furniture geometry signatures normalize overall dimensions; resizing alone is not a new shape.", "Runtime placement, interaction and visual acceptance are not verified."],
    };
  });
}

function equipmentRecords(): AssetRecord[] {
  return EQUIPMENT_CATALOG.map(item => {
    const reference = source("src/equipment/catalog.ts", "EQUIPMENT_CATALOG", item.id);
    const recipe = getEquipmentRecipe(item.modelId);
    const signature = recipe ? JSON.stringify(recipe.parts.map(part => ({ anchor: part.anchor, geometry: part.geometry, position: part.position, rotation: part.rotation })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))) : undefined;
    return {
      id: `equipment.${item.id}`, name: item.name, family: item.slot === "weapon" ? "weapon" : ["head", "chest", "gloves", "boots"].includes(item.slot) ? "armor" : "equipment-accessory",
      category: item.category === "relic-weapon" ? "relic" : item.category,
      status: recipe && signature ? "INTEGRATING" : "BLOCKED",
      source: reference,
      geometry: recipe && signature ? { source: source("src/equipment/catalog.ts", "getEquipmentRecipe", item.modelId), signature, primitiveCount: recipe.parts.length } : undefined,
      materialSignature: JSON.stringify({ accent: item.accent, materials: recipe?.parts.map(part => part.material) }),
      price: item.price, level: item.level, rarity: item.rarity, slot: item.slot,
      rigAnchors: [...item.rigAnchors],
      evidence: sourceEvidence(reference),
      limitations: ["Equipment geometry signatures compare rig-space primitive recipes, excluding names and materials; not exported mesh topology.", "Runtime equip, hand grips, clipping and visual acceptance are not verified."],
    };
  });
}

export function createAssetRegistry(): AssetRecord[] {
  return [...cosmeticRecords(), ...furnitureRecords(), ...equipmentRecords(), ...constructionRecords()];
}

export const ASSET_REGISTRY: readonly AssetRecord[] = createAssetRegistry();

export function getAsset(id: string): AssetRecord | undefined {
  return ASSET_REGISTRY.find(asset => asset.id === id);
}

export function findAssetsBySource(sourceId: string): readonly AssetRecord[] {
  return ASSET_REGISTRY.filter(asset => asset.source.id === sourceId);
}

export function validateAssetRegistry(records: readonly AssetRecord[] = ASSET_REGISTRY): AssetRegistryIssue[] {
  const issues: AssetRegistryIssue[] = [];
  const ids = new Set<string>();
  const sources = new Set<string>();
  for (const asset of records) {
    const add = (message: string) => issues.push({ assetId: asset.id, message });
    if (!asset.id.trim() || ids.has(asset.id)) add("Missing or duplicate asset id.");
    ids.add(asset.id);
    const sourceKey = `${asset.source.path}#${asset.source.exportName}:${asset.source.id}`;
    if (sources.has(sourceKey)) add("Duplicate catalog source reference.");
    sources.add(sourceKey);
    assetRecordIssues(asset).forEach(add);
    if (asset.status === "VERIFIED" && !hasRuntimeVerification(asset)) add("VERIFIED requires passing runtime evidence.");
  }
  return issues;
}
