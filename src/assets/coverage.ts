import { z } from "zod";
import type { AssetCoverageReport, AssetCoverageTarget, AssetEvidence, AssetMetrics, AssetRecord } from "./types";
import { ASSET_STATUSES } from "./types";

const categories = (family: AssetCoverageTarget["family"], counts: Record<string, number>, purchase?: AssetCoverageTarget["purchase"]): AssetCoverageTarget[] => Object.entries(counts).map(([category, target]) => ({ id: `${family}.${purchase ? `${purchase}.` : ""}${category}`, family, category, target, purchase, unit: "entries" }));

export const ASSET_COVERAGE_TARGETS: readonly AssetCoverageTarget[] = [
  { id: "cosmetic.paid", family: "cosmetic", purchase: "paid", target: 94, unit: "entries" },
  ...categories("cosmetic", { top: 18, bottom: 12, outer: 12, shoe: 12, head: 8, eyewear: 8, gloves: 6, back: 6, jewelry: 12 }, "paid"),
  { id: "cosmetic.starter", family: "cosmetic", purchase: "starter", target: 21, unit: "entries" },
  { id: "furniture", family: "furniture", target: 120, unit: "entries" },
  ...categories("furniture", { bed: 10, seating: 12, desk: 10, chair: 8, storage: 10, electronics: 12, lights: 12, kitchen: 10, decor: 16, workshop: 10, collectible: 10 }),
  { id: "weapon", family: "weapon", target: 36, unit: "entries" },
  ...categories("weapon", { tactical: 6, katana: 6, energy: 6, heavy: 6, dual: 4, relic: 8 }),
  { id: "armor", family: "armor", target: 30, unit: "entries" },
  { id: "curved-glass", family: "curved-glass", target: 6, unit: "entries" },
  { id: "straight-glass", family: "straight-glass", target: 6, unit: "entries" },
  { id: "material", family: "material", target: 12, unit: "material-definitions" },
  { id: "door", family: "door", target: 8, unit: "entries" },
];

export function assetRecordIssues(asset: AssetRecord): string[] {
  const issues: string[] = [];
  if (!asset.id.trim()) issues.push("Missing asset id.");
  if (!asset.source.path.trim() || !asset.source.exportName.trim() || !asset.source.id.trim()) issues.push("Incomplete source reference.");
  if (asset.source.sha256 !== undefined && (asset.source.sha256.length !== 64 || !/^[a-fA-F0-9]{64}$/.test(asset.source.sha256))) issues.push("Invalid source SHA-256.");
  if (!ASSET_STATUSES.includes(asset.status)) issues.push("Unknown asset status.");
  if (asset.geometry && (!asset.geometry.signature.trim() || !asset.geometry.source.id.trim() || !asset.geometry.source.path.trim() || !asset.geometry.source.exportName.trim())) issues.push("Incomplete geometry reference.");
  if (asset.price !== undefined && (!Number.isFinite(asset.price) || asset.price < 0)) issues.push("Invalid price.");
  if (asset.level !== undefined && (!Number.isInteger(asset.level) || asset.level < 1)) issues.push("Invalid level.");
  return issues;
}

const sha256Schema = z.string().length(64).regex(/^[a-fA-F0-9]{64}$/);
const evidenceReference = z.string().trim().min(1).max(4096);
export const assetVerificationBindingSchema = z.object({
  assetId: z.string().trim().min(1).max(500),
  sourceSha256: sha256Schema,
  observedSourceSha256: sha256Schema,
  environment: z.string().trim().min(1).max(2000),
  testCase: z.string().trim().min(1).max(2000),
  artifacts: z.array(z.object({ reference: evidenceReference, sha256: sha256Schema }).strict()).min(1).max(100),
}).strict();

export function hasSourceBoundEvidence(asset: AssetRecord, evidence: AssetEvidence): boolean {
  const binding = assetVerificationBindingSchema.safeParse(evidence.binding);
  if (!binding.success || !sha256Schema.safeParse(asset.source.sha256).success || !evidenceReference.safeParse(evidence.reference).success) return false;
  const hash = asset.source.sha256!.toLowerCase();
  return binding.data.assetId === asset.id
    && binding.data.sourceSha256.toLowerCase() === hash
    && binding.data.observedSourceSha256.toLowerCase() === hash;
}

export function hasRuntimeVerification(asset: AssetRecord): boolean {
  return asset.status === "VERIFIED"
    && assetRecordIssues(asset).length === 0
    && !asset.evidence.some(evidence => (evidence.kind === "runtime" || evidence.kind === "visual") && evidence.result === "failed")
    && asset.evidence.some(evidence => evidence.kind === "runtime" && evidence.result === "passed" && hasSourceBoundEvidence(asset, evidence));
}

export function assetMetrics(assets: readonly AssetRecord[]): AssetMetrics {
  const statuses = Object.fromEntries(ASSET_STATUSES.map(status => [status, 0])) as AssetMetrics["statuses"];
  const geometry = new Set<string>();
  const finishes = new Map<string, Set<string>>();
  let geometryEntries = 0;
  for (const asset of assets) {
    statuses[asset.status]++;
    if (asset.geometry) {
      geometryEntries++;
      const key = `${asset.family}:${asset.geometry.signature}`;
      geometry.add(key);
      if (asset.materialSignature !== undefined) {
        const variants = finishes.get(key) ?? new Set<string>();
        variants.add(asset.materialSignature);
        finishes.set(key, variants);
      }
    }
  }
  return {
    entries: assets.length,
    geometryEntries,
    uniqueGeometries: geometry.size,
    repeatedGeometryEntries: geometryEntries - geometry.size,
    additionalMaterialVariants: [...finishes.values()].reduce((sum, variants) => sum + Math.max(0, variants.size - 1), 0),
    materialDefinitions: assets.filter(asset => asset.family === "material").length,
    runtimeVerifiedEntries: assets.filter(hasRuntimeVerification).length,
    statuses,
  };
}

export function matchesCoverageTarget(asset: AssetRecord, target: AssetCoverageTarget): boolean {
  return asset.family === target.family
    && (target.category === undefined || asset.category === target.category)
    && (target.purchase !== "paid" || (asset.price ?? 0) > 0)
    && (target.purchase !== "starter" || (asset.starter === true && asset.price === 0));
}

export function calculateAssetCoverage(assets: readonly AssetRecord[], targets: readonly AssetCoverageTarget[] = ASSET_COVERAGE_TARGETS): AssetCoverageReport {
  const issues: string[] = [];
  const unique = new Map<string, AssetRecord>();
  const sources = new Set<string>();
  for (const asset of assets) {
    if (unique.has(asset.id)) {
      issues.push(`Duplicate asset id: ${asset.id}`);
      continue;
    }
    const recordIssues = assetRecordIssues(asset);
    if (recordIssues.length) {
      issues.push(...recordIssues.map(issue => `${asset.id}: ${issue}`));
      continue;
    }
    const sourceKey = `${asset.source.path}#${asset.source.exportName}:${asset.source.id}`;
    if (sources.has(sourceKey)) {
      issues.push(`Duplicate source reference: ${sourceKey}`);
      continue;
    }
    sources.add(sourceKey);
    unique.set(asset.id, asset);
    if (asset.status === "VERIFIED" && !hasRuntimeVerification(asset)) issues.push(`Missing passing runtime evidence: ${asset.id}`);
  }
  const records = [...unique.values()];
  const rows = targets.map(target => {
    const metrics = assetMetrics(records.filter(asset => matchesCoverageTarget(asset, target)));
    return {
      ...target, ...metrics,
      remainingEntries: Math.max(0, target.target - metrics.entries),
      remainingRuntimeVerified: Math.max(0, target.target - metrics.runtimeVerifiedEntries),
      entryTargetMet: metrics.entries >= target.target,
      status: metrics.runtimeVerifiedEntries >= target.target ? "VERIFIED" as const : "INCOMPLETE" as const,
    };
  });
  return { status: issues.length === 0 && rows.every(row => row.status === "VERIFIED") ? "VERIFIED" : "INCOMPLETE", metrics: assetMetrics(records), rows, issues };
}
