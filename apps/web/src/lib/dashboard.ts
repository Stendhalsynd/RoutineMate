import {
  calculateAdherenceRate,
  calculateDailyProgress,
  calculateGoalProgress,
  rangeToGranularity,
  rangeToDays,
  type BodyMetric,
  type DashboardBucket,
  type DashboardGranularity,
  type DashboardSummary,
  type Goal,
  type MealLog,
  type RangeKey,
  type DailyProgress,
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

function isoWeekKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

type BucketAccumulator = {
  key: string;
  label: string;
  from: string;
  to: string;
  points: DailyProgress[];
};

function buildBuckets(
  daily: DailyProgress[],
  granularity: DashboardGranularity
): DashboardBucket[] {
  if (granularity === "day") {
    return daily.map((item) => ({
      key: item.date,
      label: item.date.slice(5),
      from: item.date,
      to: item.date,
      avgOverallScore: item.overallScore,
      mealCheckRate: item.mealLogCount > 0 ? 100 : 0,
      workoutRate: item.workoutLogCount > 0 ? 100 : 0,
      bodyMetricRate: item.hasBodyMetric ? 100 : 0
    }));
  }

  const grouped = new Map<string, BucketAccumulator>();
  for (const point of daily) {
    const key = granularity === "week" ? isoWeekKey(point.date) : monthKey(point.date);
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        key,
        label: key,
        from: point.date,
        to: point.date,
        points: [point]
      });
      continue;
    }
    current.points.push(point);
    if (point.date < current.from) {
      current.from = point.date;
    }
    if (point.date > current.to) {
      current.to = point.date;
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
    .map((bucket) => {
      const dayCount = Math.max(bucket.points.length, 1);
      const overall = bucket.points.reduce((sum, item) => sum + item.overallScore, 0) / dayCount;
      const mealDays = bucket.points.filter((item) => item.mealLogCount > 0).length;
      const workoutDays = bucket.points.filter((item) => item.workoutLogCount > 0).length;
      const metricDays = bucket.points.filter((item) => item.hasBodyMetric).length;
      return {
        key: bucket.key,
        label: bucket.label,
        from: bucket.from,
        to: bucket.to,
        avgOverallScore: clampPercent(overall),
        mealCheckRate: clampPercent((mealDays / dayCount) * 100),
        workoutRate: clampPercent((workoutDays / dayCount) * 100),
        bodyMetricRate: clampPercent((metricDays / dayCount) * 100)
      };
    });
}

export function aggregateDashboard(input: DashboardInput): DashboardSummary {
  const now = input.now ?? new Date();
  const endDateKey = now.toISOString().slice(0, 10);
  const endMs = dayMs(endDateKey);
  const startMs = endMs - (rangeToDays(input.range) - 1) * 24 * 60 * 60 * 1000;
  const startDateKey = new Date(startMs).toISOString().slice(0, 10);

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
    return calculateDailyProgress(
      key,
      mealsByDate.get(key) ?? [],
      workoutsByDate.get(key) ?? [],
      (metricsByDate.get(key) ?? []).length > 0
    );
  });

  const latest = latestMetric(input.bodyMetrics);
  const rangeDays = rangeToDays(input.range);
  const granularity = rangeToGranularity(input.range);
  const buckets = buildBuckets(daily, granularity);
  const goals = input.goals.map((goal) =>
    calculateGoalProgress(goal, workouts, latest, rangeDays, endDateKey)
  );
  const daysWithAnyLog = daily.filter(
    (item) => item.mealLogCount > 0 || item.workoutLogCount > 0 || item.hasBodyMetric
  ).length;

  return {
    range: input.range,
    granularity,
    adherenceRate: calculateAdherenceRate(daily),
    totalMeals: meals.length,
    totalWorkouts: workouts.length,
    latestWeightKg: latest?.weightKg ?? null,
    latestBodyFatPct: latest?.bodyFatPct ?? null,
    daily,
    buckets,
    goals,
    consistencyMeta: {
      source: "notion",
      refreshedAt: now.toISOString(),
      range: input.range,
      windowStart: startDateKey,
      windowEnd: endDateKey,
      coveredDays: daily.length,
      mealCount: meals.length,
      workoutCount: workouts.length,
      bodyMetricCount: bodyMetrics.length,
      daysWithAnyLog
    }
  };
}
