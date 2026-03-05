import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(__dirname, "../..");
const releaseScript = path.join(repoRoot, "scripts/release-apk.sh");

function runReleaseScript(tag: string, apkPath: string, dryRun = false) {
  return spawnSync("bash", [releaseScript, tag, apkPath, "test"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(dryRun ? { RELEASE_APK_DRY_RUN: "1" } : {})
    }
  });
}

test("release-apk script rejects preview/debug apk paths", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rm-release-guard-"));
  try {
    const previewApk = path.join(dir, "routinemate-preview-20260306.apk");
    writeFileSync(previewApk, "fake");

    const result = runReleaseScript("v-test-guard", previewApk, true);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /preview|debug/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("release-apk script accepts release apk paths in dry-run mode", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rm-release-guard-"));
  try {
    const releaseApk = path.join(dir, "routinemate-release-20260306.apk");
    writeFileSync(releaseApk, "fake");

    const result = runReleaseScript("v-test-guard", releaseApk, true);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /dry-run/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
