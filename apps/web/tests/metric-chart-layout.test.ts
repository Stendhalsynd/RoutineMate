import assert from "node:assert/strict";
import test from "node:test";

import { buildMetricChartLayout } from "../src/lib/metric-chart";

test("metric chart layout keeps x coordinates inside container for narrow mobile widths", () => {
  const points = [
    { date: "2026-03-01", value: 70.2 },
    { date: "2026-03-02", value: 70.1 },
    { date: "2026-03-03", value: 70.4 },
    { date: "2026-03-04", value: 70.0 },
    { date: "2026-03-05", value: 70.5 }
  ];

  for (const width of [320, 360, 390, 768]) {
    const layout = buildMetricChartLayout(points, width);
    assert.equal(layout.width, Math.max(width, 220));
    const xMin = Math.min(...layout.coords.map((coord) => coord.x));
    const xMax = Math.max(...layout.coords.map((coord) => coord.x));
    assert.ok(xMin >= layout.padding.left - 0.0001);
    assert.ok(xMax <= layout.width - layout.padding.right + 0.0001);
    assert.ok(Number.isFinite(layout.plotWidth));
    assert.ok(layout.plotWidth > 0);
  }
});

test("metric chart path generation stays finite for single-point and empty-point states", () => {
  const single = buildMetricChartLayout([{ date: "2026-03-01", value: 69.9 }], 280);
  assert.equal(single.coords.length, 1);
  assert.equal(single.linePath.startsWith("M"), true);

  const empty = buildMetricChartLayout([], 320);
  assert.equal(empty.coords.length, 0);
  assert.equal(empty.linePath, "");
});
