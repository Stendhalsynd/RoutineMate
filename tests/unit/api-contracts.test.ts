import assert from "node:assert/strict";
import test from "node:test";

import {
  bodyMetricUpdateSchema,
  calendarRangeQuerySchema,
  quickMealLogInputSchema,
  quickMealLogUpdateSchema,
  quickWorkoutLogInputSchema,
  quickWorkoutLogUpdateSchema,
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

test("meal update contract requires at least one editable field", () => {
  const result = quickMealLogUpdateSchema.safeParse({
    sessionId: "sess-1",
    id: "meal-1"
  });
  assert.equal(result.success, false);
});

test("workout update contract accepts partial update", () => {
  const result = quickWorkoutLogUpdateSchema.safeParse({
    sessionId: "sess-1",
    id: "workout-1",
    durationMinutes: 42
  });
  assert.equal(result.success, true);
});

test("body metric update contract requires at least one value", () => {
  const result = bodyMetricUpdateSchema.safeParse({
    sessionId: "sess-1",
    id: "metric-1"
  });
  assert.equal(result.success, false);
});
