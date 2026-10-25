export const ASSET_STATUSES = ["PLANNED", "MODELING", "INTEGRATING", "TESTING", "VERIFIED", "BLOCKED"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export type AssetFamily = "cosmetic" | "furniture" | "weapon" | "armor" | "equipment-accessory" | "curved-glass" | "straight-glass" | "material" | "door" | "construction";
export interface AssetSourceReference {
  path: string;
  exportName: string;
  id: string;
  sha256?: string;
}
export interface AssetGeometryReference {
  source: AssetSourceReference;
  signature: string;
  primitiveCount?: number;
}
export interface AssetVerificationBinding {
  assetId: string;
  sourceSha256: string;
  observedSourceSha256: string;
  environment: string;
  testCase: string;
  artifacts: readonly { reference: string; sha256: string }[];
}
export interface AssetEvidence {
  kind: "source" | "static" | "runtime" | "visual";
  reference: string;
  result: "passed" | "failed" | "not-run";
  binding?: AssetVerificationBinding;
}
export interface AssetRecord {
  id: string;
  name: string;
  family: AssetFamily;
  category: string;
  status: AssetStatus;
  source: AssetSourceReference;
  geometry?: AssetGeometryReference;
  materialSignature?: string;
  price?: number;
  level?: number;
  starter?: boolean;
  rarity?: string;
  collection?: string;
  slot?: string;
  rigAnchors?: readonly string[];
  evidence: readonly AssetEvidence[];
  limitations: readonly string[];
}
export interface AssetCoverageTarget {
  id: string;
  family: AssetFamily;
  target: number;
  category?: string;
  purchase?: "paid" | "starter";
  unit: "entries" | "material-definitions";
}
export interface AssetMetrics {
  entries: number;
  geometryEntries: number;
  uniqueGeometries: number;
  repeatedGeometryEntries: number;
  additionalMaterialVariants: number;
  materialDefinitions: number;
  runtimeVerifiedEntries: number;
  statuses: Record<AssetStatus, number>;
}
export interface AssetCoverageRow extends AssetCoverageTarget, AssetMetrics {
  remainingEntries: number;
  remainingRuntimeVerified: number;
  entryTargetMet: boolean;
  status: "INCOMPLETE" | "VERIFIED";
}
export interface AssetCoverageReport {
  status: "INCOMPLETE" | "VERIFIED";
  metrics: AssetMetrics;
  rows: readonly AssetCoverageRow[];
  issues: readonly string[];
}
export interface AssetRegistryIssue {
  assetId: string;
  message: string;
}
