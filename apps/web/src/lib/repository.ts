import type {
  BodyMetric,
  Goal,
  GoalInput,
  MealLog,
  QuickMealLogInput,
  QuickWorkoutLogInput,
  Session,
  WorkoutLog,
  BodyMetricInput
} from "@routinemate/domain";

type DataStore = {
  sessions: Map<string, Session>;
  meals: MealLog[];
  workouts: WorkoutLog[];
  bodyMetrics: BodyMetric[];
  goals: Goal[];
};

const globalKey = "__routinemate_store__";

const store =
  ((globalThis as Record<string, unknown>)[globalKey] as DataStore | undefined) ?? {
    sessions: new Map<string, Session>(),
    meals: [],
    workouts: [],
    bodyMetrics: [],
    goals: []
  };

(globalThis as Record<string, unknown>)[globalKey] = store;

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const repo = {
  createGuestSession(deviceId?: string): Session {
    const timestamp = nowIso();
    const session: Session = {
      sessionId: createId("sess"),
      userId: createId("user"),
      isGuest: true,
      createdAt: timestamp
    };

    if (deviceId) {
      session.email = `${deviceId}@guest.local`;
    }

    store.sessions.set(session.sessionId, session);
    return session;
  },

  upgradeSession(sessionId: string, email: string): Session | null {
    const existing = store.sessions.get(sessionId);
    if (!existing) {
      return null;
    }

    const upgraded: Session = {
      ...existing,
      isGuest: false,
      email,
      upgradedAt: nowIso()
    };
    store.sessions.set(sessionId, upgraded);
    return upgraded;
  },

  getSession(sessionId: string): Session | null {
    return store.sessions.get(sessionId) ?? null;
  },

  addMealLog(userId: string, input: Omit<QuickMealLogInput, "sessionId">): MealLog {
    const log: MealLog = {
      id: createId("meal"),
      userId,
      date: input.date,
      mealType: input.mealType,
      foodLabel: input.foodLabel,
      portionSize: input.portionSize,
      createdAt: nowIso()
    };
    store.meals.push(log);
    return log;
  },

  addWorkoutLog(userId: string, input: Omit<QuickWorkoutLogInput, "sessionId">): WorkoutLog {
    const log: WorkoutLog = {
      id: createId("workout"),
      userId,
      date: input.date,
      bodyPart: input.bodyPart,
      purpose: input.purpose,
      tool: input.tool,
      exerciseName: input.exerciseName,
      intensity: input.intensity ?? "medium",
      createdAt: nowIso()
    };

    if (input.sets !== undefined) {
      log.sets = input.sets;
    }
    if (input.reps !== undefined) {
      log.reps = input.reps;
    }
    if (input.weightKg !== undefined) {
      log.weightKg = input.weightKg;
    }
    if (input.durationMinutes !== undefined) {
      log.durationMinutes = input.durationMinutes;
    }

    store.workouts.push(log);
    return log;
  },

  addBodyMetric(userId: string, input: Omit<BodyMetricInput, "sessionId">): BodyMetric {
    const metric: BodyMetric = {
      id: createId("metric"),
      userId,
      date: input.date,
      createdAt: nowIso()
    };

    if (input.weightKg !== undefined) {
      metric.weightKg = input.weightKg;
    }
    if (input.bodyFatPct !== undefined) {
      metric.bodyFatPct = input.bodyFatPct;
    }

    store.bodyMetrics.push(metric);
    return metric;
  },

  upsertGoal(userId: string, input: Omit<GoalInput, "sessionId">): Goal {
    const existingIndex = store.goals.findIndex((goal) => goal.userId === userId);
    const existingGoal = existingIndex >= 0 ? store.goals[existingIndex] : undefined;
    const base: Goal = {
      id: existingGoal?.id ?? createId("goal"),
      userId,
      weeklyRoutineTarget: input.weeklyRoutineTarget,
      createdAt: existingGoal?.createdAt ?? nowIso()
    };

    if (input.dDay !== undefined) {
      base.dDay = input.dDay;
    }
    if (input.targetWeightKg !== undefined) {
      base.targetWeightKg = input.targetWeightKg;
    }
    if (input.targetBodyFat !== undefined) {
      base.targetBodyFat = input.targetBodyFat;
    }

    const next: Goal = base;

    if (existingIndex >= 0) {
      store.goals[existingIndex] = next;
    } else {
      store.goals.push(next);
    }

    return next;
  },

  listMealsByUser(userId: string): MealLog[] {
    return store.meals.filter((item) => item.userId === userId);
  },

  listWorkoutsByUser(userId: string): WorkoutLog[] {
    return store.workouts.filter((item) => item.userId === userId);
  },

  listBodyMetricsByUser(userId: string): BodyMetric[] {
    return store.bodyMetrics.filter((item) => item.userId === userId);
  },

  listGoalsByUser(userId: string): Goal[] {
    return store.goals.filter((item) => item.userId === userId);
  },

  clear(): void {
    store.sessions.clear();
    store.meals.length = 0;
    store.workouts.length = 0;
    store.bodyMetrics.length = 0;
    store.goals.length = 0;
  }
};
