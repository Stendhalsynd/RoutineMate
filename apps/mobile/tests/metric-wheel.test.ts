import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  clampMetricValue,
  digitsToMetricNumber,
  formatMetricValue,
  getWheelLoopIndex,
  getWheelSeedIndices,
  isMetricDigitsAllowed,
  recenterWheelIndex,
  resolveDefaultMetricValue,
  resolveLatestMetricAxisValue,
  resolveMetricDigits,
  wrapDigit
} from "../src/lib/metric-wheel";

test("wrapDigit loops negative and positive indexes inside 0-9", () => {
  assert.equal(wrapDigit(-1), 9);
  assert.equal(wrapDigit(10), 0);
  assert.equal(wrapDigit(27), 7);
});

test("resolveMetricDigits clamps overflowing values to the allowed range", () => {
  assert.deepEqual(resolveMetricDigits("99.9", 65, 95), { tens: 9, ones: 5, tenths: 0 });
  assert.deepEqual(resolveMetricDigits("4.2", 5, 35), { tens: 0, ones: 5, tenths: 0 });
});

test("resolveDefaultMetricValue prefers current value, then recent value, then min", () => {
  assert.equal(resolveDefaultMetricValue("88.3", "87.1", 65, 95), "88.3");
  assert.equal(resolveDefaultMetricValue("", "87.1", 65, 95), "87.1");
  assert.equal(resolveDefaultMetricValue("", "", 65, 95), "65.0");
});

test("formatMetricValue keeps one decimal place", () => {
  assert.equal(formatMetricValue(clampMetricValue(88.34, 65, 95)), "88.3");
  assert.equal(formatMetricValue(clampMetricValue(95.91, 65, 95)), "95.0");
});

test("getWheelSeedIndices centers the selected digits inside a long infinite loop seed", () => {
  const indices = getWheelSeedIndices({ tens: 8, ones: 8, tenths: 3 });
  assert.equal(indices.tens % 10, 8);
  assert.equal(indices.ones % 10, 8);
  assert.equal(indices.tenths % 10, 3);
  assert.ok(indices.tens > 100);
  assert.ok(indices.ones > 100);
  assert.ok(indices.tenths > 100);
});

test("default value resolution composes into wheel seed indices for recent-value opening", () => {
  const defaultValue = resolveDefaultMetricValue("", "88.3", 65, 95);
  const digits = resolveMetricDigits(defaultValue, 65, 95);
  const indices = getWheelSeedIndices(digits);
  assert.equal(defaultValue, "88.3");
  assert.deepEqual(digits, { tens: 8, ones: 8, tenths: 3 });
  assert.equal(indices.tens % 10, 8);
  assert.equal(indices.ones % 10, 8);
  assert.equal(indices.tenths % 10, 3);
});

test("recenterWheelIndex keeps the same digit while moving back near the center of the loop", () => {
  const centered = recenterWheelIndex(298);
  assert.equal(wrapDigit(centered), wrapDigit(298));
  assert.ok(centered > 100 && centered < 200);
});

test("getWheelLoopIndex maps scroll offsets back to stable digit values", () => {
  assert.equal(getWheelLoopIndex(0), 0);
  assert.equal(getWheelLoopIndex(11), 1);
  assert.equal(getWheelLoopIndex(119), 9);
});

test("range validation rejects digit combinations outside min/max boundaries", () => {
  assert.equal(isMetricDigitsAllowed({ tens: 6, ones: 4, tenths: 9 }, 65, 95), false);
  assert.equal(isMetricDigitsAllowed({ tens: 6, ones: 5, tenths: 0 }, 65, 95), true);
  assert.equal(digitsToMetricNumber({ tens: 9, ones: 5, tenths: 0 }), 95);
});

test("resolveLatestMetricAxisValue reads latest non-deleted value per axis by date and createdAt", () => {
  const records = [
    {
      id: "old-weight",
      date: "2026-03-25",
      createdAt: "2026-03-25T08:00:00.000Z",
      weightKg: 88.1
    },
    {
      id: "new-fat",
      date: "2026-03-26",
      createdAt: "2026-03-26T08:00:00.000Z",
      bodyFatPct: 17.4
    },
    {
      id: "new-weight",
      date: "2026-03-25",
      createdAt: "2026-03-25T09:00:00.000Z",
      weightKg: 87.8
    }
  ];

  assert.equal(resolveLatestMetricAxisValue(records, "weightKg"), 87.8);
  assert.equal(resolveLatestMetricAxisValue(records, "bodyFatPct"), 17.4);
});

test("mobile picker source no longer renders legacy quick-action labels", () => {
  const appSource = fs.readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.equal(appSource.includes("\"00.0\""), true);
  assert.equal(appSource.includes("최근값"), false);
  assert.equal(appSource.includes("-0.1"), false);
  assert.equal(appSource.includes("+0.1"), false);
  assert.equal(appSource.includes("정밀 선택"), false);
  assert.equal(appSource.includes("십의"), false);
  assert.equal(appSource.includes("일의"), false);
  assert.equal(appSource.includes("소수"), false);
});

test("mobile picker highlight stays behind the selected digits", () => {
  const appSource = fs.readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(appSource, /<View pointerEvents="none" style=\{styles\.decimalWheelHighlight\} \/>/);
  assert.match(appSource, /decimalWheelHighlight:\s*{[\s\S]*?zIndex:\s*0/);
  assert.match(appSource, /decimalColumnRow:\s*{[\s\S]*?zIndex:\s*1/);
});
