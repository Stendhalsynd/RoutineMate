import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(__dirname, "../..");

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8")) as Record<string, unknown>;
}

function packageDeps(relativePath: string): Record<string, string> {
  const pkg = readJson(relativePath);
  return {
    ...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
    ...((pkg.devDependencies as Record<string, string> | undefined) ?? {})
  };
}

test("S7-1 root manifest declares firebase foundation dependencies", () => {
  const deps = packageDeps("package.json");

  assert.ok(deps.firebase, "root package.json should declare firebase");
  assert.ok(deps["firebase-admin"], "root package.json should declare firebase-admin");
  assert.ok(deps["firebase-tools"], "root package.json should declare firebase-tools");
  assert.ok(deps["@firebase/rules-unit-testing"], "root package.json should declare rules-unit-testing");
});

test("S7-1 app manifests declare firebase runtime dependencies", () => {
  const webDeps = packageDeps("apps/web/package.json");
  const mobileDeps = packageDeps("apps/mobile/package.json");

  assert.ok(webDeps.firebase, "web package should declare firebase");
  assert.ok(mobileDeps.firebase, "mobile package should declare firebase");
});

test("S7-1 repository contains firebase config scaffolding", () => {
  const requiredFiles = [
    "firebase.json",
    "firestore.rules",
    ".env.example",
    "apps/web/src/lib/firebase.ts",
    "apps/mobile/src/lib/firebase.ts",
    "docs/04_firebase_setup.md"
  ];

  for (const file of requiredFiles) {
    assert.equal(existsSync(path.join(repoRoot, file)), true, `${file} should exist`);
  }
});
