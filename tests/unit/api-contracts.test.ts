import assert from "node:assert/strict";
import test from "node:test";

import {
  calendarRangeQuerySchema,
  quickMealLogInputSchema,
  quickWorkoutLogInputSchema,
  bodyMetricInputSchema,
  dashboardQuerySchema
} from "../../packages/api-contract/src/index";

test("dashboard query defaults range to 7d", () => {
  const parsed = dashboardQuerySchema.parse({ sessionId: "sess-1" });
  assert.equal(parsed.range, "7d");
});

test("quick meal contract rejects empty food label", () => {
  const result = quickMealLogInputSchema.safeParse({
    sessionId: "sess-1",
    date: "2026-02-27",
    mealType: "breakfast",
    foodLabel: "",
    portionSize: "small"
  });

  assert.equal(result.success, false);
});

test("quick workout contract rejects unknown body part", () => {
  const result = quickWorkoutLogInputSchema.safeParse({
    sessionId: "sess-1",
    date: "2026-02-27",
    bodyPart: "hips",
    purpose: "muscle_gain",
    tool: "bodyweight",
    exerciseName: "Pushups"
  });

  assert.equal(result.success, false);
});

test("body metric requires at least one metric field", () => {
  const result = bodyMetricInputSchema.safeParse({
    sessionId: "sess-1",
    date: "2026-02-27"
  });

  assert.equal(result.success, false);
});

test("calendar range contract rejects reversed dates", () => {
  const result = calendarRangeQuerySchema.safeParse({
    from: "2026-03-01",
    to: "2026-02-27"
  });
  assert.equal(result.success, false);
});
