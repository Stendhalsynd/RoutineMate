import assert from "node:assert/strict";
import test from "node:test";

import {
  clampMetricValue,
  formatMetricValue,
  resolveMetricDigits,
  resolveQuickMetricValue,
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

test("resolveQuickMetricValue uses recent value fallback and nudges by 0.1", () => {
  assert.equal(resolveQuickMetricValue("", "88.3", 0, 65, 95), "88.3");
  assert.equal(resolveQuickMetricValue("88.3", "87.1", 0.1, 65, 95), "88.4");
  assert.equal(resolveQuickMetricValue("", "5.0", -0.1, 5, 35), "5.0");
});

test("formatMetricValue keeps one decimal place", () => {
  assert.equal(formatMetricValue(clampMetricValue(88.34, 65, 95)), "88.3");
  assert.equal(formatMetricValue(clampMetricValue(95.91, 65, 95)), "95.0");
});
