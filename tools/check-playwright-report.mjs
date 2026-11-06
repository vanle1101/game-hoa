import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("Usage: node tools/check-playwright-report.mjs <playwright-results.json>");

const report = JSON.parse(readFileSync(file, "utf8"));
const allowedSkipCounts = new Map([
  ["Pending V9 apartment contract: keep this acceptance test until the evolving shell/inventory contract is exported.", 2],
  ["Pending V9 apartment contract: preserve this topology acceptance while architecture APIs evolve.", 2],
  ["Pending V9 apartment contract: furniture placement semantics are still being integrated.", 2],
  ["Lead GPU grant required before launching real Chrome for WebGL evidence.", 2],
  ["Desktop mouse drag regression", 1],
]);
const observedSkipCounts = new Map();
const failures = [];
let total = 0;
let passed = 0;
let skipped = 0;

function visitSuite(suite, inheritedFile = "") {
  const suiteFile = suite.file ?? inheritedFile;
  for (const nested of suite.suites ?? []) visitSuite(nested, suiteFile);
  for (const spec of suite.specs ?? []) {
    const specFile = spec.file ?? suiteFile;
    for (const test of spec.tests ?? []) {
      total += 1;
      const resultStatuses = (test.results ?? []).map(result => result.status);
      const status = test.status ?? resultStatuses.at(-1) ?? "unknown";
      if (status === "skipped" || test.expectedStatus === "skipped" || resultStatuses.includes("skipped")) {
        skipped += 1;
        const annotations = [...(test.annotations ?? []), ...(test.results ?? []).flatMap(result => result.annotations ?? [])];
        const reason = annotations.find(annotation => typeof annotation.description === "string")?.description;
        if (!reason || !allowedSkipCounts.has(reason)) {
          failures.push(`Unapproved skip: ${specFile} :: ${spec.title} (${reason ?? "no reason"})`);
        } else {
          observedSkipCounts.set(reason, (observedSkipCounts.get(reason) ?? 0) + 1);
        }
      } else if (["unexpected", "flaky", "timedOut", "failed"].includes(status) || resultStatuses.some(value => ["failed", "timedOut", "interrupted"].includes(value))) {
        failures.push(`Failed E2E: ${specFile} :: ${spec.title} (${status})`);
      } else if (status === "expected" || status === "passed" || resultStatuses.includes("passed")) {
        passed += 1;
      } else {
        failures.push(`Unclassified E2E result: ${specFile} :: ${spec.title} (${status})`);
      }
    }
  }
}

for (const suite of report.suites ?? []) visitSuite(suite);
if (total === 0) failures.push("Playwright report contains no test cases.");
if (report.errors?.length) failures.push(`${report.errors.length} top-level Playwright error(s).`);

for (const [reason, expected] of allowedSkipCounts) {
  const observed = observedSkipCounts.get(reason) ?? 0;
  if (observed > expected) failures.push(`Known skip count exceeded for '${reason}': maximum ${expected}, observed ${observed}.`);
}

console.log(`Playwright full-suite report: total=${total}, passed=${passed}, skipped=${skipped}, failed-or-unclassified=${failures.length}.`);
for (const failure of failures) console.error(failure);
if (failures.length) process.exitCode = 1;
