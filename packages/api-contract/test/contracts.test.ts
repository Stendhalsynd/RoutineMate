import assert from "node:assert/strict";
import test from "node:test";

import {
  calendarRangeQuerySchema,
  calendarDayQuerySchema,
  goalInputSchema,
  quickMealLogInputSchema,
  quickWorkoutLogInputSchema
} from "../src/index";

test("quickMealLogInputSchema parses valid payload", () => {
  const parsed = quickMealLogInputSchema.parse({
    sessionId: "sess-1",
    date: "2026-02-27",
    mealType: "lunch",
    foodLabel: "Chicken bowl",
    portionSize: "large"
  });

  assert.equal(parsed.mealType, "lunch");
});

test("quickMealLogInputSchema rejects impossible calendar date", () => {
  const result = quickMealLogInputSchema.safeParse({
    sessionId: "sess-1",
    date: "2026-02-31",
    mealType: "lunch",
    foodLabel: "Chicken bowl",
    portionSize: "large"
  });
  assert.equal(result.success, false);
});

test("quickWorkoutLogInputSchema rejects invalid duration", () => {
  const result = quickWorkoutLogInputSchema.safeParse({
    sessionId: "sess-1",
    date: "2026-02-27",
    bodyPart: "full_body",
    purpose: "muscle_gain",
    tool: "bodyweight",
    exerciseName: "Circuit",
    durationMinutes: 0
  });

  assert.equal(result.success, false);
});

test("goalInputSchema validates required fields", () => {
  const result = goalInputSchema.safeParse({
    sessionId: "sess-1",
    weeklyRoutineTarget: 4
  });

  assert.equal(result.success, true);
});

test("calendarDayQuerySchema requires sessionId", () => {
  const result = calendarDayQuerySchema.safeParse({
    date: "2026-02-27"
  });

  assert.equal(result.success, false);
});

test("calendarRangeQuerySchema enforces from <= to", () => {
  const result = calendarRangeQuerySchema.safeParse({
    from: "2026-03-01",
    to: "2026-02-27"
  });
  assert.equal(result.success, false);
});
