import type {
  AuthProvider,
  BodyMetric,
  BodyMetricInput,
  GoogleProfile,
  Goal,
  GoalInput,
  MealLog,
  MealCheckin,
  MealCheckinInput,
  MealTemplate,
  ReminderEvaluation,
  ReminderSettings,
  ReminderChannel,
  WorkoutTemplate,
  MealSlot,
  QuickMealLogInput,
  QuickWorkoutLogInput,
  Session,
  WorkoutLog
} from "@routinemate/domain";
import {
  mealSlotToMealType,
  mealTypeToMealSlot
} from "@routinemate/domain";
import {
  createDatabasePage,
  getNotionDatabases,
  readDatabase,
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
  mealCheckins: MealCheckin[];
  workouts: WorkoutLog[];
  bodyMetrics: BodyMetric[];
  goals: Goal[];
  mealTemplates: MealTemplate[];
  workoutTemplates: WorkoutTemplate[];
  reminderSettings: Map<string, ReminderSettings>;
};

const globalKey = "__routinemate_store__";

const store =
  ((globalThis as Record<string, unknown>)[globalKey] as DataStore | undefined) ?? {
    sessions: new Map<string, Session>(),
    meals: [],
    mealCheckins: [],
    workouts: [],
    bodyMetrics: [],
    goals: [],
    mealTemplates: [],
    workoutTemplates: [],
    reminderSettings: new Map<string, ReminderSettings>()
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

function urlProperty(value: string): Record<string, unknown> {
  return {
    url: value
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

function getDateOrDefault(page: NotionPage, key: string, fallback: string): string {
  return getDate(page, key) ?? fallback;
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

function inDateRange(date: string, from: string, to: string): boolean {
  const key = date.slice(0, 10);
  return key >= from && key <= to;
}

function notionUserDateRangeFilter(userId: string, from: string, to: string): Record<string, unknown> {
  return {
    and: [
      { property: "UserId", rich_text: { equals: userId } },
      { property: "Date", date: { on_or_after: from } },
      { property: "Date", date: { on_or_before: to } }
    ]
  };
}

function toDeleteMeta(page: NotionPage): Pick<MealLog, "isDeleted" | "deletedAt"> {
  const isDeleted = getCheckbox(page, "IsDeleted");
  const deletedAt = getDate(page, "DeletedAt");
  return {
    ...(isDeleted !== undefined ? { isDeleted } : {}),
    ...(deletedAt ? { deletedAt } : {})
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
  const authProvider = getSelect(page, "AuthProvider") as AuthProvider | undefined;
  if (authProvider) {
    session.authProvider = authProvider;
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

function mapMeal(page: NotionPage): MealLog | null {
  const id = getRichText(page, "Id") ?? page.id;
  const userId = getRichText(page, "UserId");
  const date = getDate(page, "Date");
  const slot = getSelect(page, "MealSlot") as MealSlot | undefined;
  const mealType =
    (getSelectAny(page, ["MealType"]) as MealLog["mealType"] | undefined) ??
    (slot ? mealSlotToMealType(slot) : undefined);
  const foodLabel = getRichTextAny(page, ["FoodLabel", "Label"]) ?? "식단 체크";
  const portionSize = (getSelectAny(page, ["PortionSize"]) as MealLog["portionSize"] | undefined) ?? "medium";
  const createdAt = getDateOrDefault(page, "CreatedAt", date ?? "");
  const completed = getCheckbox(page, "Completed");
  if (completed === false) {
    return null;
  }
  if (!userId || !date || !mealType || !createdAt) {
    return null;
  }
  const templateId = getRichText(page, "TemplateId");
  return {
    id,
    userId,
    date: date.slice(0, 10),
    mealType,
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

function mapMealTemplate(page: NotionPage): MealTemplate | null {
  const id = getRichText(page, "Id") ?? page.id;
  const userId = getRichText(page, "UserId");
  const label = getRichTextAny(page, ["Label", "FoodLabel"]) ?? getTitle(page, "Name");
  const mealSlot = getSelectAny(page, ["MealSlot", "MealType"]);
  const createdAt = getDate(page, "CreatedAt");
  if (!userId || !label || !mealSlot || !createdAt) {
    return null;
  }
  return {
    id,
    userId,
    label,
    mealSlot: mealSlot === "snack" ? "dinner2" : (mealSlot as MealSlot),
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

function parseChannels(value: string | undefined): ReminderChannel[] {
  if (!value) {
    return ["web_in_app", "mobile_local"];
  }
  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0) as ReminderChannel[];
  if (parsed.length === 0) {
    return ["web_in_app", "mobile_local"];
  }
  return parsed;
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

async function findNotionUserPageById(
  databaseId: string,
  userId: string,
  recordId: string
): Promise<NotionPage | null> {
  const pages = await queryDatabasePages(databaseId, {
    filter: { property: "UserId", rich_text: { equals: userId } }
  });
  const target =
    pages
      .map(toPage)
      .find((page) => (getRichText(page, "Id") ?? page.id) === recordId) ?? null;
  return target;
}

function getReminderSettingsDbId(): string {
  const databases = getNotionDatabases();
  if (!databases.reminderSettingsDbId) {
    throw new Error("Notion integration is not configured. Missing env: NOTION_DB_REMINDER_SETTINGS");
  }
  return databases.reminderSettingsDbId;
}

function isUnknownNotionPropertyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("is not a property that exists") || message.includes("Could not find database property");
}

async function createSessionPageWithOptionalFields(
  databaseId: string,
  required: Record<string, unknown>,
  optional: Record<string, unknown>
): Promise<void> {
  try {
    await createDatabasePage(databaseId, {
      ...required,
      ...optional
    });
  } catch (error) {
    if (!isUnknownNotionPropertyError(error)) {
      throw error;
    }
    await createDatabasePage(databaseId, required);
  }
}

async function updateSessionPageWithOptionalFields(
  pageId: string,
  required: Record<string, unknown>,
  optional: Record<string, unknown>
): Promise<void> {
  try {
    await updateDatabasePage(pageId, {
      ...required,
      ...optional
    });
  } catch (error) {
    if (!isUnknownNotionPropertyError(error)) {
      throw error;
    }
    await updateDatabasePage(pageId, required);
  }
}

const schemaValidationKey = "__routinemate_schema_validation__";

async function validateDatabaseSchema(
  label: string,
  databaseId: string,
  requiredProperties: string[]
): Promise<void> {
  const database = (await readDatabase(databaseId)) as {
    properties?: Record<string, unknown>;
  };
  const existingProperties = Object.keys(database.properties ?? {});
  const missing = requiredProperties.filter((name) => !existingProperties.includes(name));
  if (missing.length > 0) {
    throw new Error(`필드명 불일치: ${label}.${missing[0]}`);
  }
}

async function ensureNotionSchemaValidated(): Promise<void> {
  if (isMemoryMode()) {
    return;
  }
  const already = (globalThis as Record<string, unknown>)[schemaValidationKey] as Promise<void> | undefined;
  if (already) {
    return already;
  }
  const promise = (async () => {
    const databases = getNotionDatabases();
    await validateDatabaseSchema("Sessions", databases.sessionsDbId, [
      "Name",
      "UserId",
      "IsGuest",
      "CreatedAt"
    ]);
    await validateDatabaseSchema("Meals", databases.mealsDbId, [
      "Name",
      "Id",
      "UserId",
      "Date",
      "MealSlot",
      "Completed",
      "IsDeleted",
      "DeletedAt",
      "CreatedAt"
    ]);
    await validateDatabaseSchema("Workouts", databases.workoutsDbId, [
      "Name",
      "Id",
      "UserId",
      "Date",
      "BodyPart",
      "Purpose",
      "Tool",
      "ExerciseName",
      "Intensity",
      "IsDeleted",
      "DeletedAt",
      "CreatedAt"
    ]);
    await validateDatabaseSchema("BodyMetrics", databases.bodyMetricsDbId, [
      "Name",
      "Id",
      "UserId",
      "Date",
      "IsDeleted",
      "DeletedAt",
      "CreatedAt"
    ]);
    await validateDatabaseSchema("Goals", databases.goalsDbId, [
      "Name",
      "Id",
      "UserId",
      "WeeklyRoutineTarget",
      "CreatedAt"
    ]);
    if (databases.mealTemplatesDbId) {
      await validateDatabaseSchema("MealTemplates", databases.mealTemplatesDbId, [
        "Name",
        "Id",
        "UserId",
        "Label",
        "MealSlot",
        "IsActive",
        "CreatedAt"
      ]);
    }
    if (databases.workoutTemplatesDbId) {
      await validateDatabaseSchema("WorkoutTemplates", databases.workoutTemplatesDbId, [
        "Name",
        "Id",
        "UserId",
        "Label",
        "BodyPart",
        "Purpose",
        "Tool",
        "IsActive",
        "CreatedAt"
      ]);
    }
    if (databases.reminderSettingsDbId) {
      await validateDatabaseSchema("ReminderSettings", databases.reminderSettingsDbId, [
        "Name",
        "Id",
        "UserId",
        "IsEnabled",
        "DailyReminderTime",
        "MissingLogReminderTime",
        "Channels",
        "Timezone",
        "CreatedAt",
        "UpdatedAt"
      ]);
    }
  })();
  const guarded = promise.catch((error) => {
    delete (globalThis as Record<string, unknown>)[schemaValidationKey];
    throw error;
  });
  (globalThis as Record<string, unknown>)[schemaValidationKey] = guarded;
  return guarded;
}

export const repo = {
  async createGuestSession(deviceId?: string): Promise<Session> {
    if (isMemoryMode()) {
      const timestamp = nowIso();
      const session: Session = {
        sessionId: createId("sess"),
        userId: createId("user"),
        isGuest: true,
        createdAt: timestamp,
        authProvider: "guest"
      };
      if (deviceId) {
        session.email = `${deviceId}@guest.local`;
      }
      store.sessions.set(session.sessionId, session);
      return session;
    }

    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const session: Session = {
      sessionId: createId("sess"),
      userId: createId("user"),
      isGuest: true,
      createdAt: nowIso(),
      authProvider: "guest"
    };

    await createSessionPageWithOptionalFields(
      databases.sessionsDbId,
      {
        Name: titleProperty(session.sessionId),
        UserId: richTextProperty(session.userId),
        IsGuest: checkboxProperty(true),
        CreatedAt: dateProperty(session.createdAt),
        ...(deviceId ? { Email: emailProperty(`${deviceId}@guest.local`) } : {})
      },
      {
        AuthProvider: selectProperty("guest")
      }
    );
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
        upgradedAt: nowIso(),
        authProvider: existing.authProvider ?? "guest"
      };
      store.sessions.set(sessionId, upgraded);
      return upgraded;
    }

    await ensureNotionSchemaValidated();
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
    await updateSessionPageWithOptionalFields(
      page.id,
      {
        IsGuest: checkboxProperty(false),
        Email: emailProperty(email),
        UpgradedAt: dateProperty(upgradedAt)
      },
      {
        AuthProvider: selectProperty("guest")
      }
    );
    const mapped = mapSession(page);
    if (!mapped) {
      return null;
    }
    return {
      ...mapped,
      isGuest: false,
      email,
      upgradedAt,
      authProvider: mapped.authProvider ?? "guest"
    };
  },

  async upgradeSessionWithGoogle(sessionId: string, profile: GoogleProfile): Promise<Session | null> {
    if (isMemoryMode()) {
      const existing = store.sessions.get(sessionId);
      if (!existing) {
        return null;
      }
      const upgraded: Session = {
        ...existing,
        isGuest: false,
        email: profile.email,
        upgradedAt: nowIso(),
        authProvider: "google",
        providerSubject: profile.sub,
        ...(profile.picture ? { avatarUrl: profile.picture } : {})
      };
      store.sessions.set(sessionId, upgraded);
      return upgraded;
    }

    await ensureNotionSchemaValidated();
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
    await updateSessionPageWithOptionalFields(
      page.id,
      {
        IsGuest: checkboxProperty(false),
        Email: emailProperty(profile.email),
        UpgradedAt: dateProperty(upgradedAt)
      },
      {
        AuthProvider: selectProperty("google"),
        ProviderSubject: richTextProperty(profile.sub),
        ...(profile.picture ? { AvatarUrl: urlProperty(profile.picture) } : {})
      }
    );

    const mapped = mapSession(page);
    if (!mapped) {
      return null;
    }
    return {
      ...mapped,
      isGuest: false,
      email: profile.email,
      upgradedAt,
      authProvider: "google",
      providerSubject: profile.sub,
      ...(profile.picture ? { avatarUrl: profile.picture } : {})
    };
  },

  async createOrRestoreGoogleSession(profile: GoogleProfile): Promise<Session> {
    if (isMemoryMode()) {
      const found =
        [...store.sessions.values()].find((item) => item.providerSubject === profile.sub && item.authProvider === "google") ??
        null;
      if (found) {
        const restored = {
          ...found,
          email: profile.email,
          ...(profile.picture ? { avatarUrl: profile.picture } : {})
        };
        store.sessions.set(restored.sessionId, restored);
        return restored;
      }
      const session: Session = {
        sessionId: createId("sess"),
        userId: createId("user"),
        isGuest: false,
        createdAt: nowIso(),
        upgradedAt: nowIso(),
        email: profile.email,
        authProvider: "google",
        providerSubject: profile.sub,
        ...(profile.picture ? { avatarUrl: profile.picture } : {})
      };
      store.sessions.set(session.sessionId, session);
      return session;
    }

    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const result = await queryDatabasePages(databases.sessionsDbId, {
      filter: {
        property: "ProviderSubject",
        rich_text: { equals: profile.sub }
      }
    });
    const existingPage = result.map(toPage).find((page) => getSelect(page, "AuthProvider") === "google") ?? null;
    if (existingPage) {
      await updateSessionPageWithOptionalFields(
        existingPage.id,
        {
          Email: emailProperty(profile.email)
        },
        {
          ...(profile.picture ? { AvatarUrl: urlProperty(profile.picture) } : {})
        }
      );
      const mappedExisting = mapSession(existingPage);
      if (mappedExisting) {
        return {
          ...mappedExisting,
          isGuest: false,
          authProvider: "google",
          providerSubject: profile.sub,
          email: profile.email,
          ...(profile.picture ? { avatarUrl: profile.picture } : {})
        };
      }
    }

    const session: Session = {
      sessionId: createId("sess"),
      userId: createId("user"),
      isGuest: false,
      createdAt: nowIso(),
      upgradedAt: nowIso(),
      email: profile.email,
      authProvider: "google",
      providerSubject: profile.sub,
      ...(profile.picture ? { avatarUrl: profile.picture } : {})
    };

    await createSessionPageWithOptionalFields(
      databases.sessionsDbId,
      {
        Name: titleProperty(session.sessionId),
        UserId: richTextProperty(session.userId),
        IsGuest: checkboxProperty(false),
        Email: emailProperty(profile.email),
        CreatedAt: dateProperty(session.createdAt),
        UpgradedAt: dateProperty(session.upgradedAt ?? session.createdAt)
      },
      {
        AuthProvider: selectProperty("google"),
        ProviderSubject: richTextProperty(profile.sub),
        ...(profile.picture ? { AvatarUrl: urlProperty(profile.picture) } : {})
      }
    );
    return session;
  },

  async getSession(sessionId: string): Promise<Session | null> {
    if (isMemoryMode()) {
      return store.sessions.get(sessionId) ?? null;
    }

    await ensureNotionSchemaValidated();
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

    await ensureNotionSchemaValidated();
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
      MealSlot: selectProperty(mealTypeToMealSlot(log.mealType)),
      Completed: checkboxProperty(true),
      IsDeleted: checkboxProperty(false),
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
        ...(input.templateId ? { templateId: input.templateId } : {}),
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

    await ensureNotionSchemaValidated();
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
      ...(input.templateId ? { templateId: input.templateId } : {}),
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
      ...(log.templateId ? { TemplateId: richTextProperty(log.templateId) } : {}),
      ...(log.sets !== undefined ? { Sets: numberProperty(log.sets) } : {}),
      ...(log.reps !== undefined ? { Reps: numberProperty(log.reps) } : {}),
      ...(log.weightKg !== undefined ? { WeightKg: numberProperty(log.weightKg) } : {}),
      ...(log.durationMinutes !== undefined ? { DurationMinutes: numberProperty(log.durationMinutes) } : {}),
      IsDeleted: checkboxProperty(false),
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

    await ensureNotionSchemaValidated();
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
      IsDeleted: checkboxProperty(false),
      CreatedAt: dateProperty(metric.createdAt)
    });
    return metric;
  },

  async addMealCheckin(userId: string, input: Omit<MealCheckinInput, "sessionId">): Promise<MealCheckin> {
    if (isMemoryMode()) {
      const existing = store.mealCheckins.find(
        (item) => item.userId === userId && item.date === input.date && item.slot === input.slot && item.isDeleted !== true
      );
      if (existing) {
        existing.completed = input.completed;
        if (input.templateId !== undefined) {
          existing.templateId = input.templateId;
        } else {
          delete existing.templateId;
        }
        return existing;
      }

      const checkin: MealCheckin = {
        id: createId("mchk"),
        userId,
        date: input.date,
        slot: input.slot,
        completed: input.completed,
        ...(input.templateId ? { templateId: input.templateId } : {}),
        isDeleted: false,
        createdAt: nowIso().slice(0, 10)
      };
      store.mealCheckins.push(checkin);
      return checkin;
    }

    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const existingPage = (
      await queryDatabasePages(databases.mealsDbId, {
        filter: { property: "UserId", rich_text: { equals: userId } },
        sorts: [{ property: "CreatedAt", direction: "descending" }]
      })
    )
      .map(toPage)
      .find((page) => {
        const current = mapMealCheckin(page);
        return current !== null && current.date === input.date && current.slot === input.slot && current.isDeleted !== true;
      });

    if (existingPage) {
      const mapped = mapMealCheckin(existingPage);
      if (mapped) {
        const next: MealCheckin = {
          ...mapped,
          completed: input.completed,
          ...(input.templateId !== undefined ? { templateId: input.templateId } : {})
        };
        await updateDatabasePage(existingPage.id, {
          Date: dateProperty(next.date),
          MealSlot: selectProperty(next.slot),
          Completed: checkboxProperty(next.completed),
          ...(next.templateId ? { TemplateId: richTextProperty(next.templateId) } : {}),
          IsDeleted: checkboxProperty(false),
          DeletedAt: { date: null }
        });
        return next;
      }
    }

    const checkin: MealCheckin = {
      id: createId("mchk"),
      userId,
      date: input.date,
      slot: input.slot,
      completed: input.completed,
      ...(input.templateId ? { templateId: input.templateId } : {}),
      isDeleted: false,
      createdAt: nowIso().slice(0, 10)
    };
    await createDatabasePage(databases.mealsDbId, {
      Name: titleProperty(`${checkin.date} ${checkin.slot}`),
      Id: richTextProperty(checkin.id),
      UserId: richTextProperty(checkin.userId),
      Date: dateProperty(checkin.date),
      MealSlot: selectProperty(checkin.slot),
      Completed: checkboxProperty(checkin.completed),
      ...(checkin.templateId ? { TemplateId: richTextProperty(checkin.templateId) } : {}),
      IsDeleted: checkboxProperty(false),
      CreatedAt: dateProperty(checkin.createdAt)
    });
    return checkin;
  },

  async updateMealCheckin(
    userId: string,
    id: string,
    updates: Partial<Pick<MealCheckin, "date" | "slot" | "completed" | "templateId">>
  ): Promise<MealCheckin | null> {
    if (isMemoryMode()) {
      const index = store.mealCheckins.findIndex((item) => item.userId === userId && item.id === id);
      if (index < 0) {
        return null;
      }
      const current = store.mealCheckins[index];
      if (!current) {
        return null;
      }
      const next: MealCheckin = {
        ...current,
        ...updates
      };
      store.mealCheckins[index] = next;
      return next;
    }

    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const page = await findNotionUserPageById(databases.mealsDbId, userId, id);
    if (!page) {
      return null;
    }
    const current = mapMealCheckin(page);
    if (!current) {
      return null;
    }
    const next: MealCheckin = {
      ...current,
      ...updates
    };
    await updateDatabasePage(page.id, {
      Date: dateProperty(next.date),
      MealSlot: selectProperty(next.slot),
      Completed: checkboxProperty(next.completed),
      ...(next.templateId ? { TemplateId: richTextProperty(next.templateId) } : {})
    });
    return next;
  },

  async listMealCheckinsByUser(userId: string): Promise<MealCheckin[]> {
    if (isMemoryMode()) {
      return store.mealCheckins.filter((item) => item.userId === userId && item.isDeleted !== true);
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const pages = await queryDatabasePages(databases.mealsDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapMealCheckin)
      .filter((item): item is MealCheckin => item !== null && item.isDeleted !== true);
  },

  async listMealCheckinsByUserInRange(userId: string, from: string, to: string): Promise<MealCheckin[]> {
    if (isMemoryMode()) {
      return store.mealCheckins.filter(
        (item) => item.userId === userId && item.isDeleted !== true && inDateRange(item.date, from, to)
      );
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const pages = await queryDatabasePages(databases.mealsDbId, {
      filter: notionUserDateRangeFilter(userId, from, to),
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapMealCheckin)
      .filter((item): item is MealCheckin => item !== null && item.isDeleted !== true);
  },

  async softDeleteMealCheckin(userId: string, id: string): Promise<boolean> {
    if (isMemoryMode()) {
      const target = store.mealCheckins.find((item) => item.userId === userId && item.id === id);
      if (!target) {
        return false;
      }
      target.isDeleted = true;
      target.deletedAt = nowIso().slice(0, 10);
      return true;
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const page = await findNotionUserPageById(databases.mealsDbId, userId, id);
    if (!page) {
      return false;
    }
    await updateDatabasePage(page.id, {
      IsDeleted: checkboxProperty(true),
      DeletedAt: dateProperty(nowIso().slice(0, 10))
    });
    return true;
  },

  async softDeleteWorkoutLog(userId: string, id: string): Promise<boolean> {
    if (isMemoryMode()) {
      const target = store.workouts.find((item) => item.userId === userId && item.id === id);
      if (!target) {
        return false;
      }
      target.isDeleted = true;
      target.deletedAt = nowIso().slice(0, 10);
      return true;
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const page = await findNotionUserPageById(databases.workoutsDbId, userId, id);
    if (!page) {
      return false;
    }
    await updateDatabasePage(page.id, {
      IsDeleted: checkboxProperty(true),
      DeletedAt: dateProperty(nowIso().slice(0, 10))
    });
    return true;
  },

  async softDeleteBodyMetric(userId: string, id: string): Promise<boolean> {
    if (isMemoryMode()) {
      const target = store.bodyMetrics.find((item) => item.userId === userId && item.id === id);
      if (!target) {
        return false;
      }
      target.isDeleted = true;
      target.deletedAt = nowIso().slice(0, 10);
      return true;
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const page = await findNotionUserPageById(databases.bodyMetricsDbId, userId, id);
    if (!page) {
      return false;
    }
    await updateDatabasePage(page.id, {
      IsDeleted: checkboxProperty(true),
      DeletedAt: dateProperty(nowIso().slice(0, 10))
    });
    return true;
  },

  async createMealTemplate(
    userId: string,
    input: Omit<MealTemplate, "id" | "userId" | "createdAt">
  ): Promise<MealTemplate> {
    if (isMemoryMode()) {
      const template: MealTemplate = {
        id: createId("mtpl"),
        userId,
        label: input.label,
        mealSlot: input.mealSlot,
        isActive: input.isActive,
        createdAt: nowIso().slice(0, 10)
      };
      store.mealTemplates.push(template);
      return template;
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    if (!databases.mealTemplatesDbId) {
      throw new Error("Notion integration is not configured. Missing env: NOTION_DB_MEAL_TEMPLATES");
    }
    const template: MealTemplate = {
      id: createId("mtpl"),
      userId,
      label: input.label,
      mealSlot: input.mealSlot,
      isActive: input.isActive,
      createdAt: nowIso().slice(0, 10)
    };
    await createDatabasePage(databases.mealTemplatesDbId, {
      Name: titleProperty(template.label),
      Id: richTextProperty(template.id),
      UserId: richTextProperty(template.userId),
      Label: richTextProperty(template.label),
      MealSlot: selectProperty(template.mealSlot),
      IsActive: checkboxProperty(template.isActive),
      CreatedAt: dateProperty(template.createdAt)
    });
    return template;
  },

  async listMealTemplatesByUser(userId: string): Promise<MealTemplate[]> {
    if (isMemoryMode()) {
      return store.mealTemplates.filter((item) => item.userId === userId);
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    if (!databases.mealTemplatesDbId) {
      return [];
    }
    const pages = await queryDatabasePages(databases.mealTemplatesDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapMealTemplate)
      .filter((item): item is MealTemplate => item !== null);
  },

  async updateMealTemplate(
    userId: string,
    id: string,
    updates: Partial<Pick<MealTemplate, "label" | "mealSlot" | "isActive">>
  ): Promise<MealTemplate | null> {
    if (isMemoryMode()) {
      const index = store.mealTemplates.findIndex((item) => item.userId === userId && item.id === id);
      if (index < 0) {
        return null;
      }
      const current = store.mealTemplates[index];
      if (!current) {
        return null;
      }
      const next: MealTemplate = {
        ...current,
        ...updates
      };
      store.mealTemplates[index] = next;
      return next;
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    if (!databases.mealTemplatesDbId) {
      return null;
    }
    const page = await findNotionUserPageById(databases.mealTemplatesDbId, userId, id);
    if (!page) {
      return null;
    }
    const current = mapMealTemplate(page);
    if (!current) {
      return null;
    }
    const next: MealTemplate = {
      ...current,
      ...updates
    };
    await updateDatabasePage(page.id, {
      Name: titleProperty(next.label),
      Label: richTextProperty(next.label),
      MealSlot: selectProperty(next.mealSlot),
      IsActive: checkboxProperty(next.isActive)
    });
    return next;
  },

  async deleteMealTemplate(userId: string, id: string): Promise<boolean> {
    const updated = await repo.updateMealTemplate(userId, id, { isActive: false });
    return updated !== null;
  },

  async createWorkoutTemplate(
    userId: string,
    input: Omit<WorkoutTemplate, "id" | "userId" | "createdAt">
  ): Promise<WorkoutTemplate> {
    if (isMemoryMode()) {
      const template: WorkoutTemplate = {
        id: createId("wtpl"),
        userId,
        label: input.label,
        bodyPart: input.bodyPart,
        purpose: input.purpose,
        tool: input.tool,
        ...(input.defaultDuration !== undefined ? { defaultDuration: input.defaultDuration } : {}),
        isActive: input.isActive,
        createdAt: nowIso().slice(0, 10)
      };
      store.workoutTemplates.push(template);
      return template;
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    if (!databases.workoutTemplatesDbId) {
      throw new Error("Notion integration is not configured. Missing env: NOTION_DB_WORKOUT_TEMPLATES");
    }
    const template: WorkoutTemplate = {
      id: createId("wtpl"),
      userId,
      label: input.label,
      bodyPart: input.bodyPart,
      purpose: input.purpose,
      tool: input.tool,
      ...(input.defaultDuration !== undefined ? { defaultDuration: input.defaultDuration } : {}),
      isActive: input.isActive,
      createdAt: nowIso().slice(0, 10)
    };
    await createDatabasePage(databases.workoutTemplatesDbId, {
      Name: titleProperty(template.label),
      Id: richTextProperty(template.id),
      UserId: richTextProperty(template.userId),
      Label: richTextProperty(template.label),
      BodyPart: selectProperty(template.bodyPart),
      Purpose: selectProperty(template.purpose),
      Tool: selectProperty(template.tool),
      ...(template.defaultDuration !== undefined ? { DefaultDuration: numberProperty(template.defaultDuration) } : {}),
      IsActive: checkboxProperty(template.isActive),
      CreatedAt: dateProperty(template.createdAt)
    });
    return template;
  },

  async listWorkoutTemplatesByUser(userId: string): Promise<WorkoutTemplate[]> {
    if (isMemoryMode()) {
      return store.workoutTemplates.filter((item) => item.userId === userId);
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    if (!databases.workoutTemplatesDbId) {
      return [];
    }
    const pages = await queryDatabasePages(databases.workoutTemplatesDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapWorkoutTemplate)
      .filter((item): item is WorkoutTemplate => item !== null);
  },

  async updateWorkoutTemplate(
    userId: string,
    id: string,
    updates: Partial<
      Pick<WorkoutTemplate, "label" | "bodyPart" | "purpose" | "tool" | "defaultDuration" | "isActive">
    >
  ): Promise<WorkoutTemplate | null> {
    if (isMemoryMode()) {
      const index = store.workoutTemplates.findIndex((item) => item.userId === userId && item.id === id);
      if (index < 0) {
        return null;
      }
      const current = store.workoutTemplates[index];
      if (!current) {
        return null;
      }
      const next: WorkoutTemplate = {
        ...current,
        ...updates
      };
      store.workoutTemplates[index] = next;
      return next;
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    if (!databases.workoutTemplatesDbId) {
      return null;
    }
    const page = await findNotionUserPageById(databases.workoutTemplatesDbId, userId, id);
    if (!page) {
      return null;
    }
    const current = mapWorkoutTemplate(page);
    if (!current) {
      return null;
    }
    const next: WorkoutTemplate = {
      ...current,
      ...updates
    };
    await updateDatabasePage(page.id, {
      Name: titleProperty(next.label),
      Label: richTextProperty(next.label),
      BodyPart: selectProperty(next.bodyPart),
      Purpose: selectProperty(next.purpose),
      Tool: selectProperty(next.tool),
      ...(next.defaultDuration !== undefined ? { DefaultDuration: numberProperty(next.defaultDuration) } : {}),
      IsActive: checkboxProperty(next.isActive)
    });
    return next;
  },

  async deleteWorkoutTemplate(userId: string, id: string): Promise<boolean> {
    const updated = await repo.updateWorkoutTemplate(userId, id, { isActive: false });
    return updated !== null;
  },

  async getReminderSettings(userId: string): Promise<ReminderSettings | null> {
    if (isMemoryMode()) {
      return store.reminderSettings.get(userId) ?? null;
    }

    await ensureNotionSchemaValidated();
    const reminderDbId = getReminderSettingsDbId();
    const pages = await queryDatabasePages(reminderDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "UpdatedAt", direction: "descending" }]
    });
    const settings =
      pages
        .map(toPage)
        .map(mapReminderSettings)
        .find((item) => item !== null) ?? null;
    return settings;
  },

  async upsertReminderSettings(
    userId: string,
    input: Omit<ReminderSettings, "id" | "userId" | "createdAt" | "updatedAt">
  ): Promise<ReminderSettings> {
    if (isMemoryMode()) {
      const existing = store.reminderSettings.get(userId);
      const timestamp = nowIso();
      const next: ReminderSettings = {
        id: existing?.id ?? createId("remind"),
        userId,
        isEnabled: input.isEnabled,
        dailyReminderTime: input.dailyReminderTime,
        missingLogReminderTime: input.missingLogReminderTime,
        channels: input.channels,
        timezone: input.timezone,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      store.reminderSettings.set(userId, next);
      return next;
    }

    await ensureNotionSchemaValidated();
    const reminderDbId = getReminderSettingsDbId();
    const pages = await queryDatabasePages(reminderDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "UpdatedAt", direction: "descending" }]
    });
    const existingPage = pages.map(toPage)[0] ?? null;
    const existing = existingPage ? mapReminderSettings(existingPage) : null;
    const timestamp = nowIso();
    const next: ReminderSettings = {
      id: existing?.id ?? createId("remind"),
      userId,
      isEnabled: input.isEnabled,
      dailyReminderTime: input.dailyReminderTime,
      missingLogReminderTime: input.missingLogReminderTime,
      channels: input.channels,
      timezone: input.timezone,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    };

    const payload = {
      Name: titleProperty("ReminderSettings"),
      Id: richTextProperty(next.id),
      UserId: richTextProperty(next.userId),
      IsEnabled: checkboxProperty(next.isEnabled),
      DailyReminderTime: richTextProperty(next.dailyReminderTime),
      MissingLogReminderTime: richTextProperty(next.missingLogReminderTime),
      Channels: richTextProperty(next.channels.join(",")),
      Timezone: richTextProperty(next.timezone),
      CreatedAt: dateProperty(next.createdAt),
      UpdatedAt: dateProperty(next.updatedAt)
    };

    if (existingPage) {
      await updateDatabasePage(existingPage.id, payload);
    } else {
      await createDatabasePage(reminderDbId, payload);
    }
    return next;
  },

  async evaluateReminder(userId: string, date: string): Promise<ReminderEvaluation> {
    const [mealCheckins, workoutLogs, bodyMetrics] = await Promise.all([
      repo.listMealCheckinsByUserInRange(userId, date, date),
      repo.listWorkoutsByUserInRange(userId, date, date),
      repo.listBodyMetricsByUserInRange(userId, date, date)
    ]);

    const mealCount = mealCheckins.filter((item) => !item.isDeleted && item.completed).length;
    const workoutCount = workoutLogs.filter((item) => !item.isDeleted).length;
    const bodyMetricCount = bodyMetrics.filter((item) => !item.isDeleted).length;

    return {
      date,
      mealCount,
      workoutCount,
      bodyMetricCount,
      isMissingLogCandidate: mealCount === 0 && workoutCount === 0 && bodyMetricCount === 0
    };
  },

  async updateMealLog(
    userId: string,
    id: string,
    updates: Partial<Pick<MealLog, "date" | "mealType" | "foodLabel" | "portionSize">>
  ): Promise<MealLog | null> {
    if (isMemoryMode()) {
      const index = store.meals.findIndex((item) => item.userId === userId && item.id === id);
      if (index < 0) {
        return null;
      }
      const current = store.meals[index];
      if (!current) {
        return null;
      }
      const next: MealLog = {
        ...current,
        ...updates
      };
      store.meals[index] = next;
      return next;
    }

    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const page = await findNotionUserPageById(databases.mealsDbId, userId, id);
    if (!page) {
      return null;
    }
    const current = mapMeal(page);
    if (!current) {
      return null;
    }

    const next: MealLog = {
      ...current,
      ...updates
    };
    await updateDatabasePage(page.id, {
      Name: titleProperty(`${next.date} ${next.foodLabel}`),
      Date: dateProperty(next.date),
      MealSlot: selectProperty(mealTypeToMealSlot(next.mealType)),
      Completed: checkboxProperty(true)
    });
    return next;
  },

  async updateWorkoutLog(
    userId: string,
    id: string,
    updates: Partial<
      Pick<
        WorkoutLog,
        | "date"
        | "bodyPart"
        | "purpose"
        | "tool"
        | "exerciseName"
        | "templateId"
        | "sets"
        | "reps"
        | "weightKg"
        | "durationMinutes"
        | "intensity"
      >
    >
  ): Promise<WorkoutLog | null> {
    if (isMemoryMode()) {
      const index = store.workouts.findIndex((item) => item.userId === userId && item.id === id);
      if (index < 0) {
        return null;
      }
      const current = store.workouts[index];
      if (!current) {
        return null;
      }
      const next: WorkoutLog = {
        ...current,
        ...updates
      };
      store.workouts[index] = next;
      return next;
    }

    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const page = await findNotionUserPageById(databases.workoutsDbId, userId, id);
    if (!page) {
      return null;
    }
    const current = mapWorkout(page);
    if (!current) {
      return null;
    }
    const next: WorkoutLog = {
      ...current,
      ...updates
    };

    await updateDatabasePage(page.id, {
      Name: titleProperty(`${next.date} ${next.exerciseName}`),
      Date: dateProperty(next.date),
      BodyPart: selectProperty(next.bodyPart),
      Purpose: selectProperty(next.purpose),
      Tool: selectProperty(next.tool),
      ExerciseName: richTextProperty(next.exerciseName),
      Intensity: selectProperty(next.intensity),
      ...(next.templateId !== undefined ? { TemplateId: richTextProperty(next.templateId) } : {}),
      ...(next.sets !== undefined ? { Sets: numberProperty(next.sets) } : {}),
      ...(next.reps !== undefined ? { Reps: numberProperty(next.reps) } : {}),
      ...(next.weightKg !== undefined ? { WeightKg: numberProperty(next.weightKg) } : {}),
      ...(next.durationMinutes !== undefined ? { DurationMinutes: numberProperty(next.durationMinutes) } : {})
    });
    return next;
  },

  async updateBodyMetric(
    userId: string,
    id: string,
    updates: Partial<Pick<BodyMetric, "date" | "weightKg" | "bodyFatPct">>
  ): Promise<BodyMetric | null> {
    if (isMemoryMode()) {
      const index = store.bodyMetrics.findIndex((item) => item.userId === userId && item.id === id);
      if (index < 0) {
        return null;
      }
      const current = store.bodyMetrics[index];
      if (!current) {
        return null;
      }
      const next: BodyMetric = {
        ...current,
        ...updates
      };
      store.bodyMetrics[index] = next;
      return next;
    }

    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const page = await findNotionUserPageById(databases.bodyMetricsDbId, userId, id);
    if (!page) {
      return null;
    }
    const current = mapBodyMetric(page);
    if (!current) {
      return null;
    }
    const next: BodyMetric = {
      ...current,
      ...updates
    };

    await updateDatabasePage(page.id, {
      Name: titleProperty(next.date),
      Date: dateProperty(next.date),
      ...(next.weightKg !== undefined ? { WeightKg: numberProperty(next.weightKg) } : {}),
      ...(next.bodyFatPct !== undefined ? { BodyFatPct: numberProperty(next.bodyFatPct) } : {})
    });
    return next;
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

    await ensureNotionSchemaValidated();
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
      return store.meals.filter((item) => item.userId === userId && item.isDeleted !== true);
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const pages = await queryDatabasePages(databases.mealsDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapMeal)
      .filter((item): item is MealLog => item !== null && item.isDeleted !== true);
  },

  async listMealsByUserInRange(userId: string, from: string, to: string): Promise<MealLog[]> {
    if (isMemoryMode()) {
      return store.meals.filter(
        (item) => item.userId === userId && item.isDeleted !== true && inDateRange(item.date, from, to)
      );
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const pages = await queryDatabasePages(databases.mealsDbId, {
      filter: notionUserDateRangeFilter(userId, from, to),
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapMeal)
      .filter((item): item is MealLog => item !== null && item.isDeleted !== true);
  },

  async listWorkoutsByUser(userId: string): Promise<WorkoutLog[]> {
    if (isMemoryMode()) {
      return store.workouts.filter((item) => item.userId === userId && item.isDeleted !== true);
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const pages = await queryDatabasePages(databases.workoutsDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapWorkout)
      .filter((item): item is WorkoutLog => item !== null && item.isDeleted !== true);
  },

  async listWorkoutsByUserInRange(userId: string, from: string, to: string): Promise<WorkoutLog[]> {
    if (isMemoryMode()) {
      return store.workouts.filter(
        (item) => item.userId === userId && item.isDeleted !== true && inDateRange(item.date, from, to)
      );
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const pages = await queryDatabasePages(databases.workoutsDbId, {
      filter: notionUserDateRangeFilter(userId, from, to),
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapWorkout)
      .filter((item): item is WorkoutLog => item !== null && item.isDeleted !== true);
  },

  async listBodyMetricsByUser(userId: string): Promise<BodyMetric[]> {
    if (isMemoryMode()) {
      return store.bodyMetrics.filter((item) => item.userId === userId && item.isDeleted !== true);
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const pages = await queryDatabasePages(databases.bodyMetricsDbId, {
      filter: { property: "UserId", rich_text: { equals: userId } },
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapBodyMetric)
      .filter((item): item is BodyMetric => item !== null && item.isDeleted !== true);
  },

  async listBodyMetricsByUserInRange(userId: string, from: string, to: string): Promise<BodyMetric[]> {
    if (isMemoryMode()) {
      return store.bodyMetrics.filter(
        (item) => item.userId === userId && item.isDeleted !== true && inDateRange(item.date, from, to)
      );
    }
    await ensureNotionSchemaValidated();
    const databases = getNotionDatabases();
    const pages = await queryDatabasePages(databases.bodyMetricsDbId, {
      filter: notionUserDateRangeFilter(userId, from, to),
      sorts: [{ property: "CreatedAt", direction: "descending" }]
    });
    return pages
      .map(toPage)
      .map(mapBodyMetric)
      .filter((item): item is BodyMetric => item !== null && item.isDeleted !== true);
  },

  async listGoalsByUser(userId: string): Promise<Goal[]> {
    if (isMemoryMode()) {
      return store.goals.filter((item) => item.userId === userId);
    }
    await ensureNotionSchemaValidated();
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
    store.mealCheckins.length = 0;
    store.workouts.length = 0;
    store.bodyMetrics.length = 0;
    store.goals.length = 0;
    store.mealTemplates.length = 0;
    store.workoutTemplates.length = 0;
    store.reminderSettings.clear();
  }
};
