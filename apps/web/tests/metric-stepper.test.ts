import assert from "node:assert/strict";
import test from "node:test";

import { adjustMetricInputValue, normalizeMetricInput } from "../src/lib/metric-stepper";

test("adjustMetricInputValue changes the value by 0.1 inside bounds", () => {
  assert.equal(adjustMetricInputValue("88.3", 0.1, 65, 95), "88.4");
  assert.equal(adjustMetricInputValue("88.3", -0.1, 65, 95), "88.2");
});

test("adjustMetricInputValue clamps values at the configured range", () => {
  assert.equal(adjustMetricInputValue("65.0", -0.1, 65, 95), "65.0");
  assert.equal(adjustMetricInputValue("95.0", 0.1, 65, 95), "95.0");
});

test("normalizeMetricInput keeps empty values and trims to one decimal place", () => {
  assert.equal(normalizeMetricInput("", 65, 95), "");
  assert.equal(normalizeMetricInput("88.34", 65, 95), "88.3");
  assert.equal(normalizeMetricInput("120", 65, 95), "95.0");
});
