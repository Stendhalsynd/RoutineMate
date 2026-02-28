import type {
  BodyMetric,
  BodyMetricInput,
  Goal,
  GoalInput,
  MealLog,
  QuickMealLogInput,
  QuickWorkoutLogInput,
  Session,
  WorkoutLog
} from "@routinemate/domain";
import {
  createDatabasePage,
  getNotionDatabases,
  queryDatabasePages,
  updateDatabasePage
} from "@/lib/notion-client";

type NotionPage = {
  id: string;
  properties: Record<string, unknown>;
};

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

function isMemoryMode(): boolean {
  if (process.env.ROUTINEMATE_REPO_MODE === "memory") {
    return true;
  }
  const hasNotionConfig =
    !!process.env.NOTION_TOKEN &&
    !!process.env.NOTION_DB_SESSIONS &&
    !!process.env.NOTION_DB_MEALS &&
    !!process.env.NOTION_DB_WORKOUTS &&
    !!process.env.NOTION_DB_BODY_METRICS &&
    !!process.env.NOTION_DB_GOALS;

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return !hasNotionConfig;
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function titleProperty(value: string): Record<string, unknown> {
  return {
    title: [{ type: "text", text: { content: value } }]
  };
}

function richTextProperty(value: string): Record<string, unknown> {
  return {
    rich_text: [{ type: "text", text: { content: value } }]
  };
}

function selectProperty(value: string): Record<string, unknown> {
  return {
    select: { name: value }
  };
}

function numberProperty(value: number): Record<string, unknown> {
  return {
    number: value
  };
}

function checkboxProperty(value: boolean): Record<string, unknown> {
  return {
    checkbox: value
  };
}

function dateProperty(value: string): Record<string, unknown> {
  return {
    date: { start: value }
  };
}

function emailProperty(value: string): Record<string, unknown> {
  return {
    email: value
  };
}

function toPage(item: unknown): NotionPage {
  const page = item as NotionPage;
  return {
    id: page.id,
    properties: page.properties ?? {}
  };
}

function propertyRecord(page: NotionPage): Record<string, unknown> {
  return page.properties ?? {};
}

function getTitle(page: NotionPage, key: string): string | undefined {
  const prop = propertyRecord(page)[key] as
    | { type?: string; title?: Array<{ plain_text?: string }> }
    | undefined;
  if (!prop || prop.type !== "title") {
    return undefined;
  }
  const value = prop.title?.[0]?.plain_text?.trim();
  return value && value.length > 0 ? value : undefined;
}

function getRichText(page: NotionPage, key: string): string | undefined {
  const prop = propertyRecord(page)[key] as
    | { type?: string; rich_text?: Array<{ plain_text?: string }> }
    | undefined;
  if (!prop || prop.type !== "rich_text") {
    return undefined;
  }
  const value = prop.rich_text?.[0]?.plain_text?.trim();
  return value && value.length > 0 ? value : undefined;
}

function getSelect(page: NotionPage, key: string): string | undefined {
  const prop = propertyRecord(page)[key] as
    | { type?: string; select?: { name?: string | null } | null }
    | undefined;
  if (!prop || prop.type !== "select") {
    return undefined;
  }
  const value = prop.select?.name?.trim();
  return value && value.length > 0 ? value : undefined;
}

function getNumber(page: NotionPage, key: string): number | undefined {
  const prop = propertyRecord(page)[key] as
    | { type?: string; number?: number | null }
    | undefined;
  if (!prop || prop.type !== "number" || prop.number === null || prop.number === undefined) {
    return undefined;
  }
  return prop.number;
}

function getDate(page: NotionPage, key: string): string | undefined {
  const prop = propertyRecord(page)[key] as
    | { type?: string; date?: { start?: string | null } | null }
    | undefined;
  if (!prop || prop.type !== "date" || !prop.date?.start) {
    return undefined;
  }
  return prop.date.start;
}

function getCheckbox(page: NotionPage, key: string): boolean | undefined {
  const prop = propertyRecord(page)[key] as
    | { type?: string; checkbox?: boolean }
    | undefined;
  if (!prop || prop.type !== "checkbox") {
    return undefined;
  }
  return prop.checkbox;
}

function getEmail(page: NotionPage, key: string): string | undefined {
  const prop = propertyRecord(page)[key] as
    | { type?: string; email?: string | null }
    | undefined;
  if (!prop || prop.type !== "email") {
    return undefined;
  }
  const value = prop.email?.trim();
  return value && value.length > 0 ? value : undefined;
}

function mapSession(page: NotionPage): Session | null {
  const sessionId = getTitle(page, "Name");
  const userId = getRichText(page, "UserId");
  const createdAt = getDate(page, "CreatedAt");
  if (!sessionId || !userId || !createdAt) {
    return null;
  }
  const session: Session = {
    sessionId,
    userId,
    isGuest: getCheckbox(page, "IsGuest") ?? true,
    createdAt
  };
  const upgradedAt = getDate(page, "UpgradedAt");
  if (upgradedAt) {
    session.upgradedAt = upgradedAt;
  }
  const email = getEmail(page, "Email");
  if (email) {
    session.email = email;
  }
  return session;
}

function mapMeal(page: NotionPage): MealLog | null {
  const id = getRichText(page, "Id") ?? page.id;
  const userId = getRichText(page, "UserId");
  const date = getDate(page, "Date");
  const mealType = getSelect(page, "MealType");
  const foodLabel = getRichText(page, "FoodLabel");
  const portionSize = getSelect(page, "PortionSize");
  const createdAt = getDate(page, "CreatedAt");
  if (!userId || !date || !mealType || !foodLabel || !portionSize || !createdAt) {
    return null;
  }
  return {
    id,
    userId,
    date: date.slice(0, 10),
    mealType: mealType as MealLog["mealType"],
    foodLabel,
    portionSize: portionSize as MealLog["portionSize"],
    createdAt
  };
}

function mapWorkout(page: NotionPage): WorkoutLog | null {
  const id = getRichText(page, "Id") ?? page.id;
  const userId = getRichText(page, "UserId");
  const date = getDate(page, "Date");
  const bodyPart = getSelect(page, "BodyPart");
  const purpose = getSelect(page, "Purpose");
  const tool = getSelect(page, "Tool");
  const exerciseName = getRichText(page, "ExerciseName");
  const intensity = getSelect(page, "Intensity") ?? "medium";
  const createdAt = getDate(page, "CreatedAt");
  if (!userId || !date || !bodyPart || !purpose || !tool || !exerciseName || !createdAt) {
    return null;
  }
  const workout: WorkoutLog = {
    id,
    userId,
    date: date.slice(0, 10),
    bodyPart: bodyPart as WorkoutLog["bodyPart"],
    purpose: purpose as WorkoutLog["purpose"],
    tool: tool as WorkoutLog["tool"],
    exerciseName,
    intensity: intensity as WorkoutLog["intensity"],
    createdAt
  };
  const sets = getNumber(page, "Sets");
  if (sets !== undefined) {
    workout.sets = sets;
  }
  const reps = getNumber(page, "Reps");
  if (reps !== undefined) {
    workout.reps = reps;
  }
  const weightKg = getNumber(page, "WeightKg");
  if (weightKg !== undefined) {
    workout.weightKg = weightKg;
  }
  const durationMinutes = getNumber(page, "DurationMinutes");
  if (durationMinutes !== undefined) {
    workout.durationMinutes = durationMinutes;
  }
  return workout;
}

function mapBodyMetric(page: NotionPage): BodyMetric | null {
  const id = getRichText(page, "Id") ?? page.id;
  const userId = getRichText(page, "UserId");
  const date = getDate(page, "Date");
  const createdAt = getDate(page, "CreatedAt");
  if (!userId || !date || !createdAt) {
    return null;
  }
  const metric: BodyMetric = {
    id,
    userId,
    date: date.slice(0, 10),
    createdAt
  };
  const weightKg = getNumber(page, "WeightKg");
  if (weightKg !== undefined) {
    metric.weightKg = weightKg;
  }
  const bodyFatPct = getNumber(page, "BodyFatPct");
  if (bodyFatPct !== undefined) {
    metric.bodyFatPct = bodyFatPct;
  }
  return metric;
}

function mapGoal(page: NotionPage): Goal | null {
  const id = getRichText(page, "Id") ?? page.id;
  const userId = getRichText(page, "UserId");
  const weeklyRoutineTarget = getNumber(page, "WeeklyRoutineTarget");
  const createdAt = getDate(page, "CreatedAt");
  if (!userId || weeklyRoutineTarget === undefined || !createdAt) {
    return null;
  }
  const goal: Goal = {
    id,
    userId,
    weeklyRoutineTarget: Math.trunc(weeklyRoutineTarget),
    createdAt
  };
  const dDay = getDate(page, "DDay");
  if (dDay) {
    goal.dDay = dDay.slice(0, 10);
  }
  const targetWeightKg = getNumber(page, "TargetWeightKg");
  if (targetWeightKg !== undefined) {
    goal.targetWeightKg = targetWeightKg;
  }
  const targetBodyFat = getNumber(page, "TargetBodyFat");
  if (targetBodyFat !== undefined) {
    goal.targetBodyFat = targetBodyFat;
  }
  return goal;
}

export const repo = {
  async createGuestSession(deviceId?: string): Promise<Session> {
    if (isMemoryMode()) {
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
    }

    const databases = getNotionDatabases();
    const session: Session = {
      sessionId: createId("sess"),
      userId: createId("user"),
      isGuest: true,
      createdAt: nowIso()
    };

    await createDatabasePage(databases.sessionsDbId, {
      Name: titleProperty(session.sessionId),
      UserId: richTextProperty(session.userId),
      IsGuest: checkboxProperty(true),
      CreatedAt: dateProperty(session.createdAt),
      ...(deviceId ? { Email: emailProperty(`${deviceId}@guest.local`) } : {})
    });
    return session;
  },

  async upgradeSession(sessionId: string, email: string): Promise<Session | null> {
    if (isMemoryMode()) {
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
    }

    const databases = getNotionDatabases();
    const result = await queryDatabasePages(databases.sessionsDbId, {
      filter: {
        property: "Name",
        title: { equals: sessionId }
      }
    });
    const page = result.map(toPage)[0];
    if (!page) {
      return null;
    }
    const upgradedAt = nowIso();
    await updateDatabasePage(page.id, {
      IsGuest: checkboxProperty(false),
      Email: emailProperty(email),
      UpgradedAt: dateProperty(upgradedAt)
    });
    const mapped = mapSession(page);
    if (!mapped) {
      return null;
    }
    return {
      ...mapped,
      isGuest: false,
      email,
      upgradedAt
    };
  },

  async getSession(sessionId: string): Promise<Session | null> {
    if (isMemoryMode()) {
      return store.sessions.get(sessionId) ?? null;
    }

    const databases = getNotionDatabases();
    const result = await queryDatabasePages(databases.sessionsDbId, {
      filter: {
        property: "Name",
        title: { equals: sessionId }
      }
    });
    const mapped = result.map(toPage).map(mapSession).find((item) => item !== null) ?? null;
    return mapped;
  },

  async addMealLog(userId: string, input: Omit<QuickMealLogInput, "sessionId">): Promise<MealLog> {
    if (isMemoryMode()) {
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
    }

    const databases = getNotionDatabases();
    const log: MealLog = {
      id: createId("meal"),
      userId,
      date: input.date,
      mealType: input.mealType,
      foodLabel: input.foodLabel,
      portionSize: input.portionSize,
      createdAt: nowIso()
    };
    await createDatabasePage(databases.mealsDbId, {
      Name: titleProperty(`${log.date} ${log.foodLabel}`),
      Id: richTextProperty(log.id),
      UserId: richTextProperty(log.userId),
      Date: dateProperty(log.date),
      MealType: selectProperty(log.mealType),
      FoodLabel: richTextProperty(log.foodLabel),
      PortionSize: selectProperty(log.portionSize),
      CreatedAt: dateProperty(log.createdAt)
    });
    return log;
  },

  async addWorkoutLog(userId: string, input: Omit<QuickWorkoutLogInput, "sessionId">): Promise<WorkoutLog> {
    if (isMemoryMode()) {
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
    }

    const databases = getNotionDatabases();
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

    await createDatabasePage(databases.workoutsDbId, {
      Name: titleProperty(`${log.date} ${log.exerciseName}`),
      Id: richTextProperty(log.id),
      UserId: richTextProperty(log.userId),
      Date: dateProperty(log.date),
      BodyPart: selectProperty(log.bodyPart),
      Purpose: selectProperty(log.purpose),
      Tool: selectProperty(log.tool),
      ExerciseName: richTextProperty(log.exerciseName),
      Intensity: selectProperty(log.intensity),
      ...(log.sets !== undefined ? { Sets: numberProperty(log.sets) } : {}),
      ...(log.reps !== undefined ? { Reps: numberProperty(log.reps) } : {}),
      ...(log.weightKg !== undefined ? { WeightKg: numberProperty(log.weightKg) } : {}),
      ...(log.durationMinutes !== undefined ? { DurationMinutes: numberProperty(log.durationMinutes) } : {}),
      CreatedAt: dateProperty(log.createdAt)
    });
    return log;
  },

  async addBodyMetric(userId: string, input: Omit<BodyMetricInput, "sessionId">): Promise<BodyMetric> {
    if (isMemoryMode()) {
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
    }

    const databases = getNotionDatabases();
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

    await createDatabasePage(databases.bodyMetricsDbId, {
      Name: titleProperty(metric.date),
      Id: richTextProperty(metric.id),
      UserId: richTextProperty(metric.userId),
      Date: dateProperty(metric.date),
      ...(metric.weightKg !== undefined ? { WeightKg: numberProperty(metric.weightKg) } : {}),
      ...(metric.bodyFatPct !== undefined ? { BodyFatPct: numberProperty(metric.bodyFatPct) } : {}),
      CreatedAt: dateProperty(metric.createdAt)
    });
    return metric;
  },

  async upsertGoal(userId: string, input: Omit<GoalInput, "sessionId">): Promise<Goal> {
    if (isMemoryMode()) {
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

      if (existingIndex >= 0) {
        store.goals[existingIndex] = base;
      } else {
        store.goals.push(base);
      }
      return base;
    }

    const databases = getNotionDatabases();
    const existingPages = (await queryDatabasePages(databases.goalsDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    })).map(toPage);
    const existingGoal = existingPages.map(mapGoal).find((item) => item !== null) ?? null;
    const next: Goal = {
      id: existingGoal?.id ?? createId("goal"),
      userId,
      weeklyRoutineTarget: input.weeklyRoutineTarget,
      createdAt: existingGoal?.createdAt ?? nowIso()
    };
    if (input.dDay !== undefined) {
      next.dDay = input.dDay;
    }
    if (input.targetWeightKg !== undefined) {
      next.targetWeightKg = input.targetWeightKg;
    }
    if (input.targetBodyFat !== undefined) {
      next.targetBodyFat = input.targetBodyFat;
    }

    const properties = {
      Name: titleProperty("Goal"),
      Id: richTextProperty(next.id),
      UserId: richTextProperty(next.userId),
      WeeklyRoutineTarget: numberProperty(next.weeklyRoutineTarget),
      ...(next.dDay !== undefined ? { DDay: dateProperty(next.dDay) } : {}),
      ...(next.targetWeightKg !== undefined ? { TargetWeightKg: numberProperty(next.targetWeightKg) } : {}),
      ...(next.targetBodyFat !== undefined ? { TargetBodyFat: numberProperty(next.targetBodyFat) } : {}),
      CreatedAt: dateProperty(next.createdAt)
    };

    const existingPage = existingPages[0];
    if (existingPage) {
      await updateDatabasePage(existingPage.id, properties);
    } else {
      await createDatabasePage(databases.goalsDbId, properties);
    }
    return next;
  },

  async listMealsByUser(userId: string): Promise<MealLog[]> {
    if (isMemoryMode()) {
      return store.meals.filter((item) => item.userId === userId);
    }
    const databases = getNotionDatabases();
    const pages = await queryDatabasePages(databases.mealsDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapMeal)
      .filter((item): item is MealLog => item !== null);
  },

  async listWorkoutsByUser(userId: string): Promise<WorkoutLog[]> {
    if (isMemoryMode()) {
      return store.workouts.filter((item) => item.userId === userId);
    }
    const databases = getNotionDatabases();
    const pages = await queryDatabasePages(databases.workoutsDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapWorkout)
      .filter((item): item is WorkoutLog => item !== null);
  },

  async listBodyMetricsByUser(userId: string): Promise<BodyMetric[]> {
    if (isMemoryMode()) {
      return store.bodyMetrics.filter((item) => item.userId === userId);
    }
    const databases = getNotionDatabases();
    const pages = await queryDatabasePages(databases.bodyMetricsDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapBodyMetric)
      .filter((item): item is BodyMetric => item !== null);
  },

  async listGoalsByUser(userId: string): Promise<Goal[]> {
    if (isMemoryMode()) {
      return store.goals.filter((item) => item.userId === userId);
    }
    const databases = getNotionDatabases();
    const pages = await queryDatabasePages(databases.goalsDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapGoal)
      .filter((item): item is Goal => item !== null);
  },

  async clear(): Promise<void> {
    if (!isMemoryMode()) {
      return;
    }
    store.sessions.clear();
    store.meals.length = 0;
    store.workouts.length = 0;
    store.bodyMetrics.length = 0;
    store.goals.length = 0;
  }
};
