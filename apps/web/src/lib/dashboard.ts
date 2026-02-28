import {
  calculateAdherenceRate,
  calculateDailyProgress,
  calculateGoalProgress,
  rangeToDays,
  type BodyMetric,
  type DashboardSummary,
  type Goal,
  type MealLog,
  type RangeKey,
  type WorkoutLog
} from "@routinemate/domain";

type DashboardInput = {
  range: RangeKey;
  meals: MealLog[];
  workouts: WorkoutLog[];
  bodyMetrics: BodyMetric[];
  goals: Goal[];
  now?: Date;
};

function dayMs(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00.000Z`);
}

function toDateKey(date: string): string {
  return date.slice(0, 10);
}

function buildDateKeys(startMs: number, endMs: number): string[] {
  const keys: string[] = [];
  for (let cursor = startMs; cursor <= endMs; cursor += 24 * 60 * 60 * 1000) {
    keys.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return keys;
}

function inWindow(date: string, startMs: number, endMs: number): boolean {
  const keyMs = dayMs(toDateKey(date));
  return keyMs >= startMs && keyMs <= endMs;
}

function latestMetric(metrics: BodyMetric[]): BodyMetric | undefined {
  return [...metrics].sort((a, b) => dayMs(toDateKey(b.date)) - dayMs(toDateKey(a.date)))[0];
}

export function aggregateDashboard(input: DashboardInput): DashboardSummary {
  const now = input.now ?? new Date();
  const endMs = dayMs(now.toISOString().slice(0, 10));
  const startMs = endMs - (rangeToDays(input.range) - 1) * 24 * 60 * 60 * 1000;

  const meals = input.meals.filter((item) => inWindow(item.date, startMs, endMs));
  const workouts = input.workouts.filter((item) => inWindow(item.date, startMs, endMs));
  const bodyMetrics = input.bodyMetrics.filter((item) => inWindow(item.date, startMs, endMs));

  const mealsByDate = new Map<string, MealLog[]>();
  const workoutsByDate = new Map<string, WorkoutLog[]>();
  const metricsByDate = new Map<string, BodyMetric[]>();

  for (const row of meals) {
    const key = toDateKey(row.date);
    const existing = mealsByDate.get(key) ?? [];
    existing.push(row);
    mealsByDate.set(key, existing);
  }

  for (const row of workouts) {
    const key = toDateKey(row.date);
    const existing = workoutsByDate.get(key) ?? [];
    existing.push(row);
    workoutsByDate.set(key, existing);
  }

  for (const row of bodyMetrics) {
    const key = toDateKey(row.date);
    const existing = metricsByDate.get(key) ?? [];
    existing.push(row);
    metricsByDate.set(key, existing);
  }

  const daily = buildDateKeys(startMs, endMs).map((key) => {
    return calculateDailyProgress(key, mealsByDate.get(key) ?? [], workoutsByDate.get(key) ?? [], (metricsByDate.get(key) ?? []).length > 0);
  });

  const latest = latestMetric(bodyMetrics);
  const rangeDays = rangeToDays(input.range);
  const goals = input.goals.map((goal) => calculateGoalProgress(goal, workouts, latest, rangeDays));

  return {
    range: input.range,
    adherenceRate: calculateAdherenceRate(daily),
    totalMeals: meals.length,
    totalWorkouts: workouts.length,
    latestWeightKg: latest?.weightKg ?? null,
    latestBodyFatPct: latest?.bodyFatPct ?? null,
    daily,
    goals
  };
}
