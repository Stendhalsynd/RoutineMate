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
  assert.equal(summary.consistencyMeta?.range, "7d");
  assert.equal(summary.consistencyMeta?.coveredDays, 7);
  assert.equal(summary.consistencyMeta?.windowStart, "2026-02-21");
  assert.equal(summary.consistencyMeta?.windowEnd, "2026-02-27");
  assert.equal(summary.consistencyMeta?.mealCount, 1);
  assert.equal(summary.consistencyMeta?.workoutCount, 1);
  assert.equal(summary.consistencyMeta?.bodyMetricCount, 1);
  assert.equal(summary.consistencyMeta?.daysWithAnyLog, 2);
});

test("aggregateDashboard aligns totals with range window for 30d and 90d", () => {
  const baseInput = {
    now: new Date("2026-03-01T00:00:00.000Z"),
    meals: [
      {
        id: "m-in-7",
        userId: "u1",
        date: "2026-02-28",
        mealType: "lunch" as const,
        foodLabel: "A",
        portionSize: "medium" as const,
        createdAt: "2026-02-28T00:00:00.000Z"
      },
      {
        id: "m-in-30",
        userId: "u1",
        date: "2026-02-10",
        mealType: "dinner" as const,
        foodLabel: "B",
        portionSize: "small" as const,
        createdAt: "2026-02-10T00:00:00.000Z"
      },
      {
        id: "m-in-90",
        userId: "u1",
        date: "2025-12-20",
        mealType: "breakfast" as const,
        foodLabel: "C",
        portionSize: "large" as const,
        createdAt: "2025-12-20T00:00:00.000Z"
      }
    ],
    workouts: [
      {
        id: "w-in-7",
        userId: "u1",
        date: "2026-02-27",
        bodyPart: "full_body" as const,
        purpose: "fat_loss" as const,
        tool: "bodyweight" as const,
        exerciseName: "Circuit",
        durationMinutes: 30,
        intensity: "medium" as const,
        createdAt: "2026-02-27T00:00:00.000Z"
      },
      {
        id: "w-in-90",
        userId: "u1",
        date: "2026-01-15",
        bodyPart: "back" as const,
        purpose: "muscle_gain" as const,
        tool: "dumbbell" as const,
        exerciseName: "Row",
        durationMinutes: 35,
        intensity: "high" as const,
        createdAt: "2026-01-15T00:00:00.000Z"
      }
    ],
    bodyMetrics: [
      {
        id: "b-old",
        userId: "u1",
        date: "2025-12-25",
        weightKg: 72,
        bodyFatPct: 21,
        createdAt: "2025-12-25T00:00:00.000Z"
      }
    ],
    goals: []
  };

  const summary30 = aggregateDashboard({
    ...baseInput,
    range: "30d"
  });
  assert.equal(summary30.totalMeals, 2);
  assert.equal(summary30.totalWorkouts, 1);
  assert.equal(summary30.daily.length, 30);
  assert.equal(summary30.consistencyMeta?.windowStart, "2026-01-31");
  assert.equal(summary30.consistencyMeta?.windowEnd, "2026-03-01");
  assert.equal(summary30.consistencyMeta?.coveredDays, 30);
  assert.equal(summary30.consistencyMeta?.mealCount, 2);
  assert.equal(summary30.consistencyMeta?.workoutCount, 1);
  assert.equal(summary30.consistencyMeta?.bodyMetricCount, 0);
  assert.equal(summary30.consistencyMeta?.daysWithAnyLog, 3);

  const summary90 = aggregateDashboard({
    ...baseInput,
    range: "90d"
  });
  assert.equal(summary90.totalMeals, 3);
  assert.equal(summary90.totalWorkouts, 2);
  assert.equal(summary90.daily.length, 90);
  assert.equal(summary90.consistencyMeta?.windowStart, "2025-12-02");
  assert.equal(summary90.consistencyMeta?.windowEnd, "2026-03-01");
  assert.equal(summary90.consistencyMeta?.coveredDays, 90);
  assert.equal(summary90.consistencyMeta?.mealCount, 3);
  assert.equal(summary90.consistencyMeta?.workoutCount, 2);
  assert.equal(summary90.consistencyMeta?.bodyMetricCount, 1);
  assert.equal(summary90.consistencyMeta?.daysWithAnyLog, 6);
});

test("aggregateDashboard includes d-day and target comparison fields in goal progress", () => {
  const summary = aggregateDashboard({
    range: "30d",
    now: new Date("2026-03-01T00:00:00.000Z"),
    meals: [],
    workouts: [
      {
        id: "w1",
        userId: "u1",
        date: "2026-02-28",
        bodyPart: "full_body",
        purpose: "fat_loss",
        tool: "bodyweight",
        exerciseName: "Circuit",
        durationMinutes: 30,
        intensity: "medium",
        createdAt: "2026-02-28T00:00:00.000Z"
      }
    ],
    bodyMetrics: [
      {
        id: "b1",
        userId: "u1",
        date: "2026-01-20",
        weightKg: 71.5,
        bodyFatPct: 19,
        createdAt: "2026-01-20T00:00:00.000Z"
      }
    ],
    goals: [
      {
        id: "g1",
        userId: "u1",
        dDay: "2026-03-10",
        targetWeightKg: 70,
        targetBodyFat: 18,
        weeklyRoutineTarget: 4,
        createdAt: "2026-02-01T00:00:00.000Z"
      }
    ]
  });

  assert.equal(summary.goals.length, 1);
  const goal = summary.goals[0];
  assert.ok(goal);
  assert.equal(goal.dDay, "2026-03-10");
  assert.equal(goal.daysToDday, 9);
  assert.equal(goal.weightDeltaKg, 1.5);
  assert.equal(goal.bodyFatDeltaPct, 1);
  assert.equal(typeof goal.goalAchievementRate, "number");
});
