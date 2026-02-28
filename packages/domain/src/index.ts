export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type PortionSize = "small" | "medium" | "large";

export type BodyPart = "chest" | "back" | "legs" | "core" | "shoulders" | "arms" | "full_body" | "cardio";
export type WorkoutPurpose = "muscle_gain" | "fat_loss" | "endurance" | "mobility" | "recovery";
export type WorkoutTool = "bodyweight" | "dumbbell" | "machine" | "barbell" | "kettlebell" | "mixed";
export type WorkoutIntensity = "low" | "medium" | "high";

export type RangeKey = "7d" | "30d" | "90d";

export interface ScoringPolicy {
  dietWeight: number;
  workoutWeight: number;
  consistencyWeight: number;
}

export const DEFAULT_SCORING_POLICY: ScoringPolicy = {
  dietWeight: 0.4,
  workoutWeight: 0.45,
  consistencyWeight: 0.15
};

export interface QuickMealLogInput {
  sessionId: string;
  date: string;
  mealType: MealType;
  foodLabel: string;
  portionSize: PortionSize;
}

export interface QuickWorkoutLogInput {
  sessionId: string;
  date: string;
  bodyPart: BodyPart;
  purpose: WorkoutPurpose;
  tool: WorkoutTool;
  exerciseName: string;
  sets?: number;
  reps?: number;
  weightKg?: number;
  durationMinutes?: number;
  intensity?: WorkoutIntensity;
}

export interface BodyMetricInput {
  sessionId: string;
  date: string;
  weightKg?: number;
  bodyFatPct?: number;
}

export interface GoalInput {
  sessionId: string;
  dDay?: string;
  targetWeightKg?: number;
  targetBodyFat?: number;
  weeklyRoutineTarget: number;
}

export interface Session {
  sessionId: string;
  userId: string;
  isGuest: boolean;
  createdAt: string;
  upgradedAt?: string;
  email?: string;
}

export interface MealLog {
  id: string;
  userId: string;
  date: string;
  mealType: MealType;
  foodLabel: string;
  portionSize: PortionSize;
  createdAt: string;
}

export interface WorkoutLog {
  id: string;
  userId: string;
  date: string;
  bodyPart: BodyPart;
  purpose: WorkoutPurpose;
  tool: WorkoutTool;
  exerciseName: string;
  sets?: number;
  reps?: number;
  weightKg?: number;
  durationMinutes?: number;
  intensity: WorkoutIntensity;
  createdAt: string;
}

export interface BodyMetric {
  id: string;
  userId: string;
  date: string;
  weightKg?: number;
  bodyFatPct?: number;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  dDay?: string;
  targetWeightKg?: number;
  targetBodyFat?: number;
  weeklyRoutineTarget: number;
  createdAt: string;
}

export interface DailyProgress {
  date: string;
  mealLogCount: number;
  workoutLogCount: number;
  hasBodyMetric: boolean;
  dietScore: number;
  workoutScore: number;
  consistencyScore: number;
  overallScore: number;
  status: "on_track" | "caution" | "off_track";
}

export interface GoalProgress {
  weeklyRoutineTarget: number;
  completedRoutineCount: number;
  averageWeeklyWorkouts: number;
  routineCompletionRate: number;
  targetWeightKg?: number;
  latestWeightKg?: number;
  targetBodyFat?: number;
  latestBodyFatPct?: number;
}

export interface CalendarCellSummary {
  date: string;
  hasMealLog: boolean;
  hasWorkoutLog: boolean;
  hasBodyMetric: boolean;
  overallScore: number;
  color: "green" | "yellow" | "red";
}

export interface DashboardSummary {
  range: RangeKey;
  adherenceRate: number;
  totalMeals: number;
  totalWorkouts: number;
  latestWeightKg: number | null;
  latestBodyFatPct: number | null;
  daily: DailyProgress[];
  goals: GoalProgress[];
  consistencyMeta?: DashboardConsistencyMeta;
}

export type QuickLogSource = "manual" | "copied_yesterday" | "copied_recent";

export interface WorkoutSuggestion {
  bodyPart: BodyPart;
  purpose: WorkoutPurpose;
  tool: WorkoutTool;
  exerciseName: string;
  reason?: string;
}

export interface DashboardConsistencyMeta {
  source: "notion";
  refreshedAt: string;
  range: RangeKey;
}

const INTENSITY_MULTIPLIER: Record<WorkoutIntensity, number> = {
  low: 0.8,
  medium: 1,
  high: 1.2
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeWeights(policy: ScoringPolicy): ScoringPolicy {
  const total = policy.dietWeight + policy.workoutWeight + policy.consistencyWeight;
  if (total <= 0) {
    return DEFAULT_SCORING_POLICY;
  }
  return {
    dietWeight: policy.dietWeight / total,
    workoutWeight: policy.workoutWeight / total,
    consistencyWeight: policy.consistencyWeight / total
  };
}

function toDateKey(date: string): string {
  return date.slice(0, 10);
}

export function rangeToDays(range: RangeKey): number {
  if (range === "30d") {
    return 30;
  }
  if (range === "90d") {
    return 90;
  }
  return 7;
}

export function calculateDietScore(mealLogsOrCount: QuickMealLogInput[] | MealLog[] | number): number {
  const count = typeof mealLogsOrCount === "number" ? mealLogsOrCount : mealLogsOrCount.length;
  return clamp((count / 3) * 100);
}

export function calculateWorkoutScore(workoutLogsOrCount: QuickWorkoutLogInput[] | WorkoutLog[] | number): number {
  if (typeof workoutLogsOrCount === "number") {
    return clamp((workoutLogsOrCount / 1) * 100);
  }

  if (workoutLogsOrCount.length === 0) {
    return 0;
  }

  const weightedMinutes = workoutLogsOrCount.reduce((acc, item) => {
    const minutes = item.durationMinutes ?? 30;
    const intensity = item.intensity ?? "medium";
    return acc + minutes * INTENSITY_MULTIPLIER[intensity];
  }, 0);

  return clamp((weightedMinutes / 45) * 100);
}

export function calculateDailyProgress(
  date: string,
  mealLogs: QuickMealLogInput[] | MealLog[],
  workoutLogs: QuickWorkoutLogInput[] | WorkoutLog[],
  hasBodyMetric = false,
  policy: ScoringPolicy = DEFAULT_SCORING_POLICY
): DailyProgress {
  const normalized = normalizeWeights(policy);
  const dietScore = calculateDietScore(mealLogs);
  const workoutScore = calculateWorkoutScore(workoutLogs);
  const consistencyScore = hasBodyMetric ? 100 : mealLogs.length + workoutLogs.length > 0 ? 70 : 0;
  const overallScore = clamp(
    dietScore * normalized.dietWeight +
      workoutScore * normalized.workoutWeight +
      consistencyScore * normalized.consistencyWeight
  );

  let status: DailyProgress["status"] = "off_track";
  if (overallScore >= 80) {
    status = "on_track";
  } else if (overallScore >= 50) {
    status = "caution";
  }

  return {
    date,
    mealLogCount: mealLogs.length,
    workoutLogCount: workoutLogs.length,
    hasBodyMetric,
    dietScore,
    workoutScore,
    consistencyScore,
    overallScore,
    status
  };
}

export function toCalendarCellSummary(progress: DailyProgress): CalendarCellSummary {
  const color = progress.status === "on_track" ? "green" : progress.status === "caution" ? "yellow" : "red";
  return {
    date: progress.date,
    hasMealLog: progress.mealLogCount > 0,
    hasWorkoutLog: progress.workoutLogCount > 0,
    hasBodyMetric: progress.hasBodyMetric,
    overallScore: progress.overallScore,
    color
  };
}

export function calculateGoalProgress(
  goal: Goal,
  workouts: WorkoutLog[],
  latestMetric?: BodyMetric,
  rangeDays = 7
): GoalProgress {
  const completedRoutineCount = workouts.length;
  const effectiveWeeks = Math.max(rangeDays / 7, 1);
  const averageWeeklyWorkouts = Number((completedRoutineCount / effectiveWeeks).toFixed(1));
  const routineCompletionRate = clamp(
    (averageWeeklyWorkouts / Math.max(goal.weeklyRoutineTarget, 1)) * 100
  );

  const result: GoalProgress = {
    weeklyRoutineTarget: goal.weeklyRoutineTarget,
    completedRoutineCount,
    averageWeeklyWorkouts,
    routineCompletionRate
  };

  if (goal.targetWeightKg !== undefined) {
    result.targetWeightKg = goal.targetWeightKg;
  }
  if (latestMetric?.weightKg !== undefined) {
    result.latestWeightKg = latestMetric.weightKg;
  }
  if (goal.targetBodyFat !== undefined) {
    result.targetBodyFat = goal.targetBodyFat;
  }
  if (latestMetric?.bodyFatPct !== undefined) {
    result.latestBodyFatPct = latestMetric.bodyFatPct;
  }

  return result;
}

export function calculateAdherenceRate(daily: DailyProgress[]): number {
  if (daily.length === 0) {
    return 0;
  }
  const sum = daily.reduce((acc, item) => acc + item.overallScore, 0);
  return clamp(sum / daily.length);
}

export function groupByDate<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = toDateKey(item.date);
    const existing = map.get(key);
    if (existing) {
      existing.push(item);
      continue;
    }
    map.set(key, [item]);
  }
  return map;
}
