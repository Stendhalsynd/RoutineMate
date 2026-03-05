import assert from "node:assert/strict";
import test from "node:test";

import { computeLegacyChartWidth, computeMetricChartWidth } from "../src/lib/metric-chart-width";

test("legacy width formula can overflow available container width", () => {
  const viewportWidth = 390;
  const availableContainerWidth = 246;
  const legacyWidth = computeLegacyChartWidth(viewportWidth);
  assert.ok(legacyWidth > availableContainerWidth);
});

test("container-based width stays inside available width for common mobile breakpoints", () => {
  const candidates = [246, 286, 316, 694];
  for (const availableContainerWidth of candidates) {
    const width = computeMetricChartWidth(availableContainerWidth);
    assert.ok(width <= availableContainerWidth);
    assert.ok(width >= 0);
  }
});

test("container-based width handles boundary inputs", () => {
  const cases = [
    { input: 0, expected: 0 },
    { input: 1, expected: 1 },
    { input: 119, expected: 119 },
    { input: 120, expected: 120 },
    { input: 121, expected: 121 }
  ];
  for (const item of cases) {
    assert.equal(computeMetricChartWidth(item.input), item.expected);
  }
});

test("container-based width fits exact available space", () => {
  const availableContainerWidth = 280;
  assert.equal(computeMetricChartWidth(availableContainerWidth), availableContainerWidth);
});
