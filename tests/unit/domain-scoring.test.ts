import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDailyProgress,
  calculateDietScore,
  calculateGoalProgress,
  type Goal,
  type WorkoutLog
} from "../../packages/domain/src/index";

const date = "2026-02-27";

const mealLogs = [
  { sessionId: "sess-1", date, mealType: "breakfast" as const, foodLabel: "Oatmeal", portionSize: "medium" as const },
  { sessionId: "sess-1", date, mealType: "lunch" as const, foodLabel: "Rice bowl", portionSize: "large" as const },
  { sessionId: "sess-1", date, mealType: "dinner" as const, foodLabel: "Salmon", portionSize: "small" as const }
];

const workoutLogs = [
  {
    sessionId: "sess-1",
    date,
    bodyPart: "full_body" as const,
    purpose: "muscle_gain" as const,
    tool: "dumbbell" as const,
    exerciseName: "Strength circuit",
    durationMinutes: 40,
    intensity: "medium" as const
  }
];

test("diet score reaches 100 at minimum full-log count", () => {
  assert.equal(calculateDietScore(mealLogs), 100);
});

test("daily progress computes weighted score and on_track status", () => {
  const progress = calculateDailyProgress(date, mealLogs, workoutLogs, true);
  assert.equal(progress.status, "on_track");
  assert.equal(progress.overallScore >= 80, true);
});

test("goal progress clamps completion rate to 100", () => {
  const goal: Goal = {
    id: "goal-2",
    userId: "user-2",
    weeklyRoutineTarget: 3,
    createdAt: `${date}T00:00:00.000Z`
  };
  const workouts: WorkoutLog[] = [
    {
      id: "w1",
      userId: "user-2",
      date,
      bodyPart: "full_body",
      purpose: "muscle_gain",
      tool: "dumbbell",
      exerciseName: "A",
      intensity: "medium",
      createdAt: `${date}T00:00:00.000Z`
    },
    {
      id: "w2",
      userId: "user-2",
      date,
      bodyPart: "full_body",
      purpose: "muscle_gain",
      tool: "dumbbell",
      exerciseName: "B",
      intensity: "medium",
      createdAt: `${date}T00:00:00.000Z`
    },
    {
      id: "w3",
      userId: "user-2",
      date,
      bodyPart: "full_body",
      purpose: "muscle_gain",
      tool: "dumbbell",
      exerciseName: "C",
      intensity: "medium",
      createdAt: `${date}T00:00:00.000Z`
    },
    {
      id: "w4",
      userId: "user-2",
      date,
      bodyPart: "full_body",
      purpose: "muscle_gain",
      tool: "dumbbell",
      exerciseName: "D",
      intensity: "medium",
      createdAt: `${date}T00:00:00.000Z`
    }
  ];

  const result = calculateGoalProgress(goal, workouts);
  assert.equal(result.routineCompletionRate, 100);
});
