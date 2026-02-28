import assert from "node:assert/strict";
import test from "node:test";

import { aggregateDashboard } from "../src/lib/dashboard";

test("aggregateDashboard summarizes data in selected range", () => {
  const summary = aggregateDashboard({
    range: "7d",
    now: new Date("2026-02-27T00:00:00.000Z"),
    meals: [
      {
        id: "m1",
        userId: "u1",
        date: "2026-02-26",
        mealType: "lunch",
        foodLabel: "Bibimbap",
        portionSize: "medium",
        createdAt: "2026-02-26T00:00:00.000Z"
      },
      {
        id: "m2",
        userId: "u1",
        date: "2026-01-10",
        mealType: "dinner",
        foodLabel: "Salad",
        portionSize: "small",
        createdAt: "2026-01-10T00:00:00.000Z"
      }
    ],
    workouts: [
      {
        id: "w1",
        userId: "u1",
        date: "2026-02-25",
        bodyPart: "full_body",
        purpose: "muscle_gain",
        tool: "dumbbell",
        exerciseName: "Circuit",
        durationMinutes: 30,
        intensity: "medium",
        createdAt: "2026-02-25T00:00:00.000Z"
      }
    ],
    bodyMetrics: [
      {
        id: "b1",
        userId: "u1",
        date: "2026-02-26",
        weightKg: 69,
        bodyFatPct: 18,
        createdAt: "2026-02-26T00:00:00.000Z"
      }
    ],
    goals: [
      {
        id: "g1",
        userId: "u1",
        weeklyRoutineTarget: 4,
        createdAt: "2026-02-01T00:00:00.000Z"
      }
    ]
  });

  assert.equal(summary.range, "7d");
  assert.equal(summary.totalMeals, 1);
  assert.equal(summary.totalWorkouts, 1);
  assert.equal(summary.latestWeightKg, 69);
  assert.equal(summary.goals.length, 1);
  assert.equal(summary.daily.length, 7);
});
