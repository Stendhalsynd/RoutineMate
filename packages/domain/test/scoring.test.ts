import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAdherenceRate,
  calculateDailyProgress,
  calculateGoalProgress,
  calculateWorkoutScore,
  toCalendarCellSummary,
  type Goal,
  type WorkoutLog
} from "../src/index";

function meal(date: string) {
  return {
    sessionId: "sess-1",
    date,
    mealType: "lunch" as const,
    foodLabel: "template meal",
    portionSize: "medium" as const
  };
}

function workout(date: string, intensity: "low" | "medium" | "high", durationMinutes: number) {
  return {
    sessionId: "sess-1",
    date,
    bodyPart: "full_body" as const,
    purpose: "muscle_gain" as const,
    tool: "dumbbell" as const,
    exerciseName: "template",
    durationMinutes,
    intensity
  };
}

test("calculateWorkoutScore applies intensity and caps to 100", () => {
  const score = calculateWorkoutScore([workout("2026-02-27", "high", 30), workout("2026-02-27", "medium", 20)]);
  assert.equal(score, 100);
});

test("calculateDailyProgress sets status by thresholds", () => {
  const progress = calculateDailyProgress("2026-02-27", [meal("2026-02-27"), meal("2026-02-27")], [workout("2026-02-27", "low", 20)]);

  assert.equal(progress.status, "caution");
  assert.equal(progress.mealLogCount, 2);
  assert.equal(progress.workoutLogCount, 1);
});

test("calculateGoalProgress combines routine count with target", () => {
  const goal: Goal = {
    id: "goal-1",
    userId: "user-1",
    weeklyRoutineTarget: 4,
    createdAt: "2026-02-27T00:00:00.000Z"
  };
  const workouts: WorkoutLog[] = [
    {
      id: "w1",
      userId: "user-1",
      date: "2026-02-27",
      bodyPart: "full_body",
      purpose: "muscle_gain",
      tool: "dumbbell",
      exerciseName: "A",
      durationMinutes: 30,
      intensity: "medium",
      createdAt: "2026-02-27T00:00:00.000Z"
    },
    {
      id: "w2",
      userId: "user-1",
      date: "2026-02-27",
      bodyPart: "full_body",
      purpose: "muscle_gain",
      tool: "dumbbell",
      exerciseName: "B",
      durationMinutes: 30,
      intensity: "medium",
      createdAt: "2026-02-27T00:00:00.000Z"
    },
    {
      id: "w3",
      userId: "user-1",
      date: "2026-02-27",
      bodyPart: "full_body",
      purpose: "muscle_gain",
      tool: "dumbbell",
      exerciseName: "C",
      durationMinutes: 30,
      intensity: "medium",
      createdAt: "2026-02-27T00:00:00.000Z"
    }
  ];

  const goalProgress = calculateGoalProgress(goal, workouts);
  assert.equal(goalProgress.routineCompletionRate, 75);
});

test("calculateGoalProgress normalizes completion by range length", () => {
  const goal: Goal = {
    id: "goal-30d",
    userId: "user-1",
    weeklyRoutineTarget: 4,
    createdAt: "2026-02-01T00:00:00.000Z"
  };
  const workouts: WorkoutLog[] = Array.from({ length: 8 }).map((_, index) => ({
    id: `w-${index}`,
    userId: "user-1",
    date: "2026-02-27",
    bodyPart: "full_body",
    purpose: "muscle_gain",
    tool: "dumbbell",
    exerciseName: "A",
    durationMinutes: 30,
    intensity: "medium",
    createdAt: "2026-02-27T00:00:00.000Z"
  }));

  const goalProgress = calculateGoalProgress(goal, workouts, undefined, 30);
  assert.equal(goalProgress.averageWeeklyWorkouts, 1.9);
  assert.equal(goalProgress.routineCompletionRate, 48);
});

test("toCalendarCellSummary maps status to color", () => {
  const progress = calculateDailyProgress("2026-02-27", [], []);
  const summary = toCalendarCellSummary(progress);

  assert.equal(summary.color, "red");
  assert.equal(summary.hasMealLog, false);
  assert.equal(summary.hasWorkoutLog, false);
});

test("calculateAdherenceRate averages daily scores", () => {
  const dayA = calculateDailyProgress("2026-02-27", [meal("2026-02-27")], [], false);
  const dayB = calculateDailyProgress("2026-02-28", [meal("2026-02-28")], [workout("2026-02-28", "medium", 30)], true);
  assert.equal(calculateAdherenceRate([dayA, dayB]), Math.round((dayA.overallScore + dayB.overallScore) / 2));
});
