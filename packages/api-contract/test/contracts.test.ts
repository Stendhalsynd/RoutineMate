import assert from "node:assert/strict";
import test from "node:test";

import {
  bootstrapQuerySchema,
  bootstrapResponseSchema,
  bodyMetricUpdateSchema,
  calendarRangeQuerySchema,
  calendarDayQuerySchema,
  goalInputSchema,
  mealCheckinInputSchema,
  mealTemplateInputSchema,
  quickMealLogInputSchema,
  quickMealLogUpdateSchema,
  quickWorkoutLogInputSchema,
  quickWorkoutLogUpdateSchema,
  softDeleteSchema,
  workoutTemplateInputSchema
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

test("quickMealLogUpdateSchema rejects payload without update fields", () => {
  const result = quickMealLogUpdateSchema.safeParse({
    sessionId: "sess-1",
    id: "meal-1"
  });
  assert.equal(result.success, false);
});

test("mealCheckinInputSchema parses dinner2 slot payload", () => {
  const result = mealCheckinInputSchema.safeParse({
    sessionId: "sess-1",
    date: "2026-03-01",
    slot: "dinner2",
    completed: true
  });
  assert.equal(result.success, true);
});

test("quickWorkoutLogUpdateSchema parses valid partial payload", () => {
  const result = quickWorkoutLogUpdateSchema.safeParse({
    sessionId: "sess-1",
    id: "workout-1",
    intensity: "high"
  });
  assert.equal(result.success, true);
});

test("bodyMetricUpdateSchema requires at least one field", () => {
  const result = bodyMetricUpdateSchema.safeParse({
    sessionId: "sess-1",
    id: "metric-1"
  });
  assert.equal(result.success, false);
});

test("softDeleteSchema requires id and sessionId", () => {
  const result = softDeleteSchema.safeParse({
    sessionId: "sess-1",
    id: "log-1"
  });
  assert.equal(result.success, true);
});

test("mealTemplateInputSchema validates required fields", () => {
  const result = mealTemplateInputSchema.safeParse({
    sessionId: "sess-1",
    label: "닭가슴살 샐러드",
    mealSlot: "dinner"
  });
  assert.equal(result.success, true);
});

test("workoutTemplateInputSchema validates required fields", () => {
  const result = workoutTemplateInputSchema.safeParse({
    sessionId: "sess-1",
    label: "하체 루틴 A",
    bodyPart: "legs",
    purpose: "muscle_gain",
    tool: "barbell"
  });
  assert.equal(result.success, true);
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

test("bootstrapQuerySchema parses view/range/date with optional session", () => {
  const result = bootstrapQuerySchema.safeParse({
    view: "records",
    range: "30d",
    date: "2026-03-01"
  });
  assert.equal(result.success, true);
});

test("bootstrapResponseSchema accepts nullable session payload", () => {
  const result = bootstrapResponseSchema.safeParse({
    session: null,
    fetchedAt: "2026-03-01T12:00:00.000Z"
  });
  assert.equal(result.success, true);
});
