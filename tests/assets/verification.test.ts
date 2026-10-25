import { describe, expect, it } from "vitest";
import { assetRecordIssues, assetVerificationBindingSchema, calculateAssetCoverage, hasRuntimeVerification, hasSourceBoundEvidence } from "../../src/assets/coverage";
import { ASSET_REGISTRY } from "../../src/assets/registry";
import type { AssetRecord, AssetVerificationBinding } from "../../src/assets/types";

const hash = "a".repeat(64);
const binding = (): AssetVerificationBinding => ({
  assetId: "fixture.asset", sourceSha256: hash, observedSourceSha256: hash,
  environment: "synthetic chromium fixture / test build", testCase: "fixture equip and interaction",
  artifacts: [{ reference: "fixture://runtime-capture", sha256: "b".repeat(64) }],
});
const record = (): AssetRecord => ({
  id: "fixture.asset", name: "Synthetic fixture", family: "furniture", category: "desk", status: "VERIFIED",
  source: { path: "fixture/catalog.ts", exportName: "FIXTURE", id: "fixture-id", sha256: hash },
  evidence: [{ kind: "runtime", reference: "fixture://test-result", result: "passed", binding: binding() }], limitations: [],
});
const target = [{ id: "fixture", family: "furniture" as const, target: 1, unit: "entries" as const }];

function expectRejected(asset: AssetRecord) {
  expect(hasRuntimeVerification(asset)).toBe(false);
  expect(calculateAssetCoverage([asset], target).status).toBe("INCOMPLETE");
  expect(calculateAssetCoverage([asset], target).metrics.runtimeVerifiedEntries).toBe(0);
}

describe("source-bound verification metadata", () => {
  it("accepts well-formed synthetic binding without modifying real registry", () => {
    const before = JSON.stringify(ASSET_REGISTRY);
    expect(assetVerificationBindingSchema.safeParse(binding()).success).toBe(true);
    expect(hasSourceBoundEvidence(record(), record().evidence[0])).toBe(true);
    expect(hasRuntimeVerification(record())).toBe(true);
    expect(calculateAssetCoverage([record()], target).status).toBe("VERIFIED");
    expect(JSON.stringify(ASSET_REGISTRY)).toBe(before);
    expect(ASSET_REGISTRY.some(asset => asset.status === "VERIFIED")).toBe(false);
    expect(calculateAssetCoverage(ASSET_REGISTRY).metrics.runtimeVerifiedEntries).toBe(0);
    expect(calculateAssetCoverage(ASSET_REGISTRY).status).toBe("INCOMPLETE");
  });
  it("rejects arbitrary nonempty passing references without bindings", () => {
    const asset = record();
    asset.evidence = [{ kind: "runtime", reference: "fake://looks-passed", result: "passed" }];
    expectRejected(asset);
    asset.evidence = [{ kind: "static", reference: "fixture://unit", result: "passed", binding: binding() }];
    expectRejected(asset);
  });
  it("rejects malformed hashes in every binding position", () => {
    for (const invalid of ["", "a".repeat(63), "a".repeat(65), "g".repeat(64), ` ${hash}`, `${hash}\n`]) {
      for (const key of ["sourceSha256", "observedSourceSha256"] as const) {
        const asset = record(), evidence = asset.evidence[0];
        asset.evidence = [{ ...evidence, binding: { ...binding(), [key]: invalid } }];
        expectRejected(asset);
      }
      const source = record(); source.source.sha256 = invalid;
      expect(assetRecordIssues(source)).toContain("Invalid source SHA-256.");
      expectRejected(source);
      const artifact = record(); artifact.evidence = [{ ...artifact.evidence[0], binding: { ...binding(), artifacts: [{ reference: "fixture://capture", sha256: invalid }] } }];
      expectRejected(artifact);
    }
  });
  it("rejects missing source hash and stale claimed or observed hashes", () => {
    const absent = record(); delete absent.source.sha256;
    expectRejected(absent);
    for (const key of ["sourceSha256", "observedSourceSha256"] as const) {
      const asset = record(); asset.evidence = [{ ...asset.evidence[0], binding: { ...binding(), [key]: "c".repeat(64) } }];
      expectRejected(asset);
    }
    const newSource = record(); newSource.source.sha256 = "c".repeat(64);
    expectRejected(newSource);
  });
  it("normalizes hexadecimal case but not whitespace or nonhex characters", () => {
    const asset = record(); asset.source.sha256 = hash.toUpperCase();
    expect(hasRuntimeVerification(asset)).toBe(true);
  });
  it("rejects a binding from another asset even when source file hash matches", () => {
    const asset = record(); asset.evidence = [{ ...asset.evidence[0], binding: { ...binding(), assetId: "fixture.other" } }];
    expectRejected(asset);
  });
  it("requires environment, test case, artifact references and evidence reference", () => {
    for (const key of ["environment", "testCase"] as const) {
      const asset = record(); asset.evidence = [{ ...asset.evidence[0], binding: { ...binding(), [key]: "  " } }];
      expectRejected(asset);
    }
    for (const artifacts of [[], [{ reference: " ", sha256: hash }]]) {
      const asset = record(); asset.evidence = [{ ...asset.evidence[0], binding: { ...binding(), artifacts } }];
      expectRejected(asset);
    }
    const blank = record(); blank.evidence = [{ ...blank.evidence[0], reference: " " }]; expectRejected(blank);
  });
  it("strictly rejects missing and surplus binding fields and malformed objects", () => {
    for (const key of Object.keys(binding())) {
      const incomplete: Record<string, unknown> = { ...binding() }; delete incomplete[key];
      expect(assetVerificationBindingSchema.safeParse(incomplete).success).toBe(false);
    }
    for (const value of [null, "passed", {}, { ...binding(), approved: true }, { ...binding(), artifacts: [{ reference: "fixture://capture", sha256: hash, passed: true }] }]) {
      expect(assetVerificationBindingSchema.safeParse(value).success).toBe(false);
    }
  });
  it.each(["runtime", "visual"] as const)("vetoes any failed %s evidence despite a valid passing record", kind => {
    const asset = record(); asset.evidence = [...asset.evidence, { kind, result: "failed", reference: "fixture://failure" }];
    expectRejected(asset);
    asset.evidence = [...asset.evidence].reverse();
    expectRejected(asset);
  });
  it("does not auto-promote statuses or not-run/visual-only records", () => {
    for (const status of ["PLANNED", "MODELING", "INTEGRATING", "TESTING", "BLOCKED"] as const) expectRejected({ ...record(), status });
    const notRun = record(); notRun.evidence = [{ ...notRun.evidence[0], result: "not-run" }]; expectRejected(notRun);
    const visual = record(); visual.evidence = [{ ...visual.evidence[0], kind: "visual" }]; expectRejected(visual);
  });
});
