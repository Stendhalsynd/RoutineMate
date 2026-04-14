import type {
  AuthProvider,
  BodyMetric,
  Goal,
  MealCheckin,
  MealLog,
  MealSlot,
  MealTemplate,
  ReminderChannel,
  ReminderSettings,
  Session,
  WorkoutLog,
  WorkoutSlot,
  WorkoutTemplate
} from "@routinemate/domain";
import { mealSlotToMealType } from "@routinemate/domain";

import { getNotionDatabases, queryDatabasePages } from "./notion-client";
import type { NotionMigrationSource } from "./firestore-migration";

type NotionPage = {
  id: string;
  properties: Record<string, unknown>;
};

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

function getUrl(page: NotionPage, key: string): string | undefined {
  const prop = propertyRecord(page)[key] as
    | { type?: string; url?: string | null }
    | undefined;
  if (!prop || prop.type !== "url") {
    return undefined;
  }
  const value = prop.url?.trim();
  return value && value.length > 0 ? value : undefined;
}

function getRichTextAny(page: NotionPage, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getRichText(page, key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function getSelectAny(page: NotionPage, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getSelect(page, key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function getDateOrDefault(page: NotionPage, key: string, fallback: string): string {
  return getDate(page, key) ?? fallback;
}

function toDeleteMeta(page: NotionPage): Pick<MealLog, "isDeleted" | "deletedAt"> {
  const isDeleted = getCheckbox(page, "IsDeleted");
  const deletedAt = getDate(page, "DeletedAt");
  return {
    ...(isDeleted !== undefined ? { isDeleted } : {}),
    ...(deletedAt ? { deletedAt: deletedAt.slice(0, 10) } : {})
  };
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
    createdAt,
    authProvider: (getSelect(page, "AuthProvider") as AuthProvider | undefined) ?? "guest"
  };

  const upgradedAt = getDate(page, "UpgradedAt");
  if (upgradedAt) {
    session.upgradedAt = upgradedAt;
  }
  const email = getEmail(page, "Email");
  if (email) {
    session.email = email;
  }
  const providerSubject = getRichText(page, "ProviderSubject");
  if (providerSubject) {
    session.providerSubject = providerSubject;
  }
  const avatarUrl = getUrl(page, "AvatarUrl");
  if (avatarUrl) {
    session.avatarUrl = avatarUrl;
  }

  return session;
}

function mapMealLog(page: NotionPage): MealLog | null {
  const id = getRichText(page, "Id") ?? page.id;
  const userId = getRichText(page, "UserId");
  const date = getDate(page, "Date");
  const mealSlot = getSelectAny(page, ["MealSlot", "MealType"]);
  const foodLabel = getRichTextAny(page, ["FoodLabel", "Label"]);
  const portionSize = getSelect(page, "PortionSize") as MealLog["portionSize"] | undefined;
  const createdAt = getDateOrDefault(page, "CreatedAt", date ?? "");
  const completed = getCheckbox(page, "Completed");

  if (!userId || !date || !mealSlot || !foodLabel || !portionSize || !createdAt || completed === false) {
    return null;
  }

  const templateId = getRichText(page, "TemplateId");

  return {
    id,
    userId,
    date: date.slice(0, 10),
    mealType: mealSlotToMealType(mealSlot as MealSlot),
    foodLabel,
    portionSize,
    ...(templateId ? { templateId } : {}),
    ...toDeleteMeta(page),
    createdAt: createdAt.slice(0, 10)
  };
}

function mapMealCheckin(page: NotionPage): MealCheckin | null {
  const id = getRichText(page, "Id") ?? page.id;
  const userId = getRichText(page, "UserId");
  const date = getDate(page, "Date");
  const slot = getSelectAny(page, ["MealSlot", "MealType"]);
  const completed = getCheckbox(page, "Completed");
  const createdAt = getDateOrDefault(page, "CreatedAt", date ?? "");
  if (!userId || !date || !slot || completed === undefined || !createdAt) {
    return null;
  }

  const templateId = getRichText(page, "TemplateId");

  return {
    id,
    userId,
    date: date.slice(0, 10),
    slot: slot === "snack" ? "dinner2" : (slot as MealSlot),
    completed,
    ...(templateId ? { templateId } : {}),
    ...toDeleteMeta(page),
    createdAt: createdAt.slice(0, 10)
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
    createdAt: createdAt.slice(0, 10),
    ...toDeleteMeta(page)
  };

  const templateId = getRichText(page, "TemplateId");
  if (templateId) {
    workout.templateId = templateId;
  }
  const workoutSlot = getSelect(page, "WorkoutSlot");
  if (workoutSlot === "am" || workoutSlot === "pm") {
    workout.workoutSlot = workoutSlot as WorkoutSlot;
  }
  const completed = getCheckbox(page, "Completed");
  if (completed !== undefined) {
    workout.completed = completed;
  }
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
    createdAt: createdAt.slice(0, 10),
    ...toDeleteMeta(page)
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

function mapMealTemplate(page: NotionPage): MealTemplate | null {
  const id = getRichText(page, "Id") ?? page.id;
  const userId = getRichText(page, "UserId");
  const label = getRichTextAny(page, ["Label", "FoodLabel"]) ?? getTitle(page, "Name");
  const mealSlot = getSelectAny(page, ["MealSlot", "MealType"]);
  const createdAt = getDate(page, "CreatedAt");
  if (!userId || !label || !createdAt) {
    return null;
  }

  return {
    id,
    userId,
    label,
    ...(mealSlot
      ? { mealSlot: mealSlot === "snack" ? "dinner2" : (mealSlot as MealSlot) }
      : {}),
    isActive: getCheckbox(page, "IsActive") ?? true,
    createdAt: createdAt.slice(0, 10)
  };
}

function mapWorkoutTemplate(page: NotionPage): WorkoutTemplate | null {
  const id = getRichText(page, "Id") ?? page.id;
  const userId = getRichText(page, "UserId");
  const label = getRichText(page, "Label") ?? getTitle(page, "Name");
  const bodyPart = getSelect(page, "BodyPart");
  const purpose = getSelect(page, "Purpose");
  const tool = getSelect(page, "Tool");
  const createdAt = getDate(page, "CreatedAt");
  if (!userId || !label || !bodyPart || !purpose || !tool || !createdAt) {
    return null;
  }

  const defaultDuration = getNumber(page, "DefaultDuration");
  return {
    id,
    userId,
    label,
    bodyPart: bodyPart as WorkoutTemplate["bodyPart"],
    purpose: purpose as WorkoutTemplate["purpose"],
    tool: tool as WorkoutTemplate["tool"],
    ...(defaultDuration !== undefined ? { defaultDuration } : {}),
    isActive: getCheckbox(page, "IsActive") ?? true,
    createdAt: createdAt.slice(0, 10)
  };
}

function parseChannels(value: string | undefined): ReminderChannel[] {
  if (!value) {
    return ["web_in_app", "mobile_local"];
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0) as ReminderChannel[];

  return parsed.length > 0 ? parsed : ["web_in_app", "mobile_local"];
}

function mapReminderSettings(page: NotionPage): ReminderSettings | null {
  const id = getRichText(page, "Id") ?? page.id;
  const userId = getRichText(page, "UserId");
  const createdAt = getDate(page, "CreatedAt");
  const updatedAt = getDate(page, "UpdatedAt");
  if (!userId || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    userId,
    isEnabled: getCheckbox(page, "IsEnabled") ?? true,
    dailyReminderTime: getRichText(page, "DailyReminderTime") ?? "20:00",
    missingLogReminderTime: getRichText(page, "MissingLogReminderTime") ?? "21:30",
    channels: parseChannels(getRichText(page, "Channels")),
    timezone: getRichText(page, "Timezone") ?? "Asia/Seoul",
    createdAt,
    updatedAt
  };
}

function isMealLogPage(page: NotionPage): boolean {
  return (
    getRichTextAny(page, ["FoodLabel", "Label"]) !== undefined ||
    getSelect(page, "PortionSize") !== undefined ||
    getSelect(page, "MealType") !== undefined
  );
}

async function queryPages(databaseId: string, userId?: string): Promise<NotionPage[]> {
  const payload = userId
    ? {
        filter: {
          property: "UserId",
          rich_text: { equals: userId }
        }
      }
    : undefined;

  return (await queryDatabasePages(databaseId, payload)).map(toPage);
}

async function queryOptionalPages(databaseId: string | undefined, userId?: string): Promise<NotionPage[]> {
  if (!databaseId) {
    return [];
  }
  return queryPages(databaseId, userId);
}

export async function readNotionMigrationSource(userId?: string): Promise<NotionMigrationSource> {
  const databases = getNotionDatabases();

  const [
    sessionPages,
    mealPages,
    workoutPages,
    bodyMetricPages,
    goalPages,
    mealTemplatePages,
    workoutTemplatePages,
    reminderSettingsPages
  ] = await Promise.all([
    queryPages(databases.sessionsDbId, userId),
    queryPages(databases.mealsDbId, userId),
    queryPages(databases.workoutsDbId, userId),
    queryPages(databases.bodyMetricsDbId, userId),
    queryPages(databases.goalsDbId, userId),
    queryOptionalPages(databases.mealTemplatesDbId, userId),
    queryOptionalPages(databases.workoutTemplatesDbId, userId),
    queryOptionalPages(databases.reminderSettingsDbId, userId)
  ]);

  return {
    sessions: sessionPages.map(mapSession).filter((item): item is Session => item !== null),
    mealLogs: mealPages
      .filter((page) => isMealLogPage(page))
      .map(mapMealLog)
      .filter((item): item is MealLog => item !== null),
    mealCheckins: mealPages
      .filter((page) => !isMealLogPage(page))
      .map(mapMealCheckin)
      .filter((item): item is MealCheckin => item !== null),
    workoutLogs: workoutPages.map(mapWorkout).filter((item): item is WorkoutLog => item !== null),
    bodyMetrics: bodyMetricPages.map(mapBodyMetric).filter((item): item is BodyMetric => item !== null),
    goals: goalPages.map(mapGoal).filter((item): item is Goal => item !== null),
    mealTemplates: mealTemplatePages.map(mapMealTemplate).filter((item): item is MealTemplate => item !== null),
    workoutTemplates: workoutTemplatePages
      .map(mapWorkoutTemplate)
      .filter((item): item is WorkoutTemplate => item !== null),
    reminderSettings: reminderSettingsPages
      .map(mapReminderSettings)
      .filter((item): item is ReminderSettings => item !== null)
  };
}
