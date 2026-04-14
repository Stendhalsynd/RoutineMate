import type {
  BodyMetric,
  BodyMetricInput,
  Goal,
  GoalInput,
  MealCheckin,
  MealCheckinInput,
  MealLog,
  MealTemplate,
  QuickMealLogInput,
  QuickWorkoutLogInput,
  ReminderEvaluation,
  ReminderSettings,
  WorkoutLog,
  WorkoutTemplate
} from "@routinemate/domain";

import { getFirebaseAdminFirestore } from "./firestore-admin";
import {
  userDocPath,
  userSubcollectionPath,
  userSubdocumentPath,
  type FirestoreUserSubcollection
} from "./firestore-schema";

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayIsoDate(): string {
  return nowIso().slice(0, 10);
}

function inDateRange(date: string, from: string, to: string): boolean {
  const key = date.slice(0, 10);
  return key >= from && key <= to;
}

function compareByDateDesc(left: string, right: string): number {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs !== rightMs) {
    return rightMs - leftMs;
  }
  return right.localeCompare(left);
}

function sortByCreatedAtDesc<T extends { createdAt: string; id: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const createdOrder = compareByDateDesc(left.createdAt, right.createdAt);
    if (createdOrder !== 0) {
      return createdOrder;
    }
    return right.id.localeCompare(left.id);
  });
}

async function ensureUserRoot(userId: string): Promise<void> {
  const db = getFirebaseAdminFirestore();
  await db.doc(userDocPath(userId)).set(
    {
      uid: userId,
      legacyUserId: userId,
      storageUserId: userId,
      source: "runtime",
      authProvider: "guest",
      isGuest: true,
      createdAt: nowIso()
    },
    { merge: true }
  );
}

async function listCollection<T extends { id: string }>(
  userId: string,
  collection: FirestoreUserSubcollection
): Promise<T[]> {
  const db = getFirebaseAdminFirestore();
  const snapshot = await db.collection(userSubcollectionPath(userId, collection)).get();
  return snapshot.docs.map((doc) => ({ ...(doc.data() as object), id: doc.id }) as T);
}

async function writeCollectionDocument<T extends { id: string }>(
  userId: string,
  collection: FirestoreUserSubcollection,
  record: T
): Promise<T> {
  const db = getFirebaseAdminFirestore();
  await ensureUserRoot(userId);
  await db.doc(userSubdocumentPath(userId, collection, record.id)).set(record as unknown as Record<string, unknown>, {
    merge: true
  });
  return record;
}

async function updateCollectionDocument<T extends { id: string }>(
  userId: string,
  collection: FirestoreUserSubcollection,
  id: string,
  updates: Partial<T>
): Promise<T | null> {
  const db = getFirebaseAdminFirestore();
  const ref = db.doc(userSubdocumentPath(userId, collection, id));
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return null;
  }
  const current = { ...(snapshot.data() as object), id } as T;
  const next = { ...current, ...updates };
  await ref.set(next as unknown as Record<string, unknown>, { merge: true });
  return next;
}

async function listMealLogs(userId: string): Promise<MealLog[]> {
  const items = await listCollection<MealLog>(userId, "mealLogs");
  return sortByCreatedAtDesc(items).filter((item) => item.isDeleted !== true);
}

async function listMealCheckins(userId: string): Promise<MealCheckin[]> {
  const items = await listCollection<MealCheckin>(userId, "mealCheckins");
  return sortByCreatedAtDesc(items).filter((item) => item.isDeleted !== true);
}

async function listWorkoutLogs(userId: string): Promise<WorkoutLog[]> {
  const items = await listCollection<WorkoutLog>(userId, "workoutLogs");
  return sortByCreatedAtDesc(items).filter((item) => item.isDeleted !== true);
}

async function listBodyMetrics(userId: string): Promise<BodyMetric[]> {
  const items = await listCollection<BodyMetric>(userId, "bodyMetrics");
  return sortByCreatedAtDesc(items).filter((item) => item.isDeleted !== true);
}

async function listGoals(userId: string): Promise<Goal[]> {
  const items = await listCollection<Goal>(userId, "goals");
  return sortByCreatedAtDesc(items);
}

export function isFirestoreDataMode(): boolean {
  const mode = process.env.ROUTINEMATE_REPO_MODE?.trim() ?? process.env.ROUTINEMATE_REPO_DATA_MODE?.trim();
  if (mode === "memory" || mode === "notion") {
    return false;
  }
  if (mode === "firebase" || mode === "firestore") {
    return true;
  }

  return Boolean(
    process.env.FIREBASE_PROJECT_ID?.trim() &&
      (process.env.FIREBASE_CLIENT_EMAIL?.trim() || process.env.FIRESTORE_EMULATOR_HOST?.trim())
  );
}

export const firestoreDataRepo = {
  async addMealLog(userId: string, input: Omit<QuickMealLogInput, "sessionId">): Promise<MealLog> {
    const log: MealLog = {
      id: createId("meal"),
      userId,
      date: input.date,
      mealType: input.mealType,
      foodLabel: input.foodLabel,
      portionSize: input.portionSize,
      createdAt: nowIso(),
      isDeleted: false
    };
    return writeCollectionDocument(userId, "mealLogs", log);
  },

  async addWorkoutLog(userId: string, input: Omit<QuickWorkoutLogInput, "sessionId">): Promise<WorkoutLog> {
    const log: WorkoutLog = {
      id: createId("workout"),
      userId,
      date: input.date,
      bodyPart: input.bodyPart,
      purpose: input.purpose,
      tool: input.tool,
      exerciseName: input.exerciseName,
      intensity: input.intensity ?? "medium",
      ...(input.workoutSlot ? { workoutSlot: input.workoutSlot } : {}),
      ...(input.completed !== undefined ? { completed: input.completed } : {}),
      ...(input.templateId ? { templateId: input.templateId } : {}),
      ...(input.sets !== undefined ? { sets: input.sets } : {}),
      ...(input.reps !== undefined ? { reps: input.reps } : {}),
      ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
      createdAt: nowIso(),
      isDeleted: false
    };
    return writeCollectionDocument(userId, "workoutLogs", log);
  },

  async addBodyMetric(userId: string, input: Omit<BodyMetricInput, "sessionId">): Promise<BodyMetric> {
    const metric: BodyMetric = {
      id: createId("metric"),
      userId,
      date: input.date,
      ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
      ...(input.bodyFatPct !== undefined ? { bodyFatPct: input.bodyFatPct } : {}),
      createdAt: nowIso(),
      isDeleted: false
    };
    return writeCollectionDocument(userId, "bodyMetrics", metric);
  },

  async addMealCheckin(userId: string, input: Omit<MealCheckinInput, "sessionId">): Promise<MealCheckin> {
    const existing = (await listMealCheckins(userId)).find(
      (item) => item.date === input.date && item.slot === input.slot && item.isDeleted !== true
    );

    if (existing) {
      const next: MealCheckin = {
        ...existing,
        completed: input.completed,
        ...(input.completed && input.templateId ? { templateId: input.templateId } : {}),
        isDeleted: false
      };
      if (!input.completed) {
        delete next.templateId;
      }
      delete next.deletedAt;
      await writeCollectionDocument(userId, "mealCheckins", next);
      return next;
    }

    const checkin: MealCheckin = {
      id: createId("mchk"),
      userId,
      date: input.date,
      slot: input.slot,
      completed: input.completed,
      ...(input.completed && input.templateId ? { templateId: input.templateId } : {}),
      createdAt: todayIsoDate(),
      isDeleted: false
    };
    return writeCollectionDocument(userId, "mealCheckins", checkin);
  },

  async updateMealCheckin(
    userId: string,
    id: string,
    updates: Partial<Pick<MealCheckin, "date" | "slot" | "completed" | "templateId">>
  ): Promise<MealCheckin | null> {
    const next = await updateCollectionDocument<MealCheckin>(userId, "mealCheckins", id, updates);
    if (!next) {
      return null;
    }
    if (next.completed === false) {
      delete next.templateId;
      await writeCollectionDocument(userId, "mealCheckins", next);
    }
    return next;
  },

  async listMealCheckinsByUser(userId: string): Promise<MealCheckin[]> {
    return listMealCheckins(userId);
  },

  async listMealCheckinsByUserInRange(userId: string, from: string, to: string): Promise<MealCheckin[]> {
    return (await listMealCheckins(userId)).filter((item) => inDateRange(item.date, from, to));
  },

  async softDeleteMealCheckin(userId: string, id: string): Promise<boolean> {
    const next = await updateCollectionDocument<MealCheckin>(userId, "mealCheckins", id, {
      isDeleted: true,
      deletedAt: todayIsoDate()
    } as Partial<MealCheckin>);
    return next !== null;
  },

  async softDeleteWorkoutLog(userId: string, id: string): Promise<boolean> {
    const next = await updateCollectionDocument<WorkoutLog>(userId, "workoutLogs", id, {
      isDeleted: true,
      deletedAt: todayIsoDate()
    } as Partial<WorkoutLog>);
    return next !== null;
  },

  async softDeleteBodyMetric(userId: string, id: string): Promise<boolean> {
    const next = await updateCollectionDocument<BodyMetric>(userId, "bodyMetrics", id, {
      isDeleted: true,
      deletedAt: todayIsoDate()
    } as Partial<BodyMetric>);
    return next !== null;
  },

  async createMealTemplate(
    userId: string,
    input: Omit<MealTemplate, "id" | "userId" | "createdAt">
  ): Promise<MealTemplate> {
    const template: MealTemplate = {
      id: createId("mtpl"),
      userId,
      label: input.label,
      ...(input.mealSlot ? { mealSlot: input.mealSlot } : {}),
      isActive: input.isActive,
      createdAt: todayIsoDate()
    };
    return writeCollectionDocument(userId, "mealTemplates", template);
  },

  async listMealTemplatesByUser(userId: string): Promise<MealTemplate[]> {
    const items = await listCollection<MealTemplate>(userId, "mealTemplates");
    return sortByCreatedAtDesc(items);
  },

  async updateMealTemplate(
    userId: string,
    id: string,
    updates: Partial<Pick<MealTemplate, "label" | "isActive">>
  ): Promise<MealTemplate | null> {
    return updateCollectionDocument<MealTemplate>(userId, "mealTemplates", id, updates);
  },

  async deleteMealTemplate(userId: string, id: string): Promise<boolean> {
    const updated = await this.updateMealTemplate(userId, id, { isActive: false });
    return updated !== null;
  },

  async createWorkoutTemplate(
    userId: string,
    input: Omit<WorkoutTemplate, "id" | "userId" | "createdAt">
  ): Promise<WorkoutTemplate> {
    const template: WorkoutTemplate = {
      id: createId("wtpl"),
      userId,
      label: input.label,
      bodyPart: input.bodyPart,
      purpose: input.purpose,
      tool: input.tool,
      ...(input.defaultDuration !== undefined ? { defaultDuration: input.defaultDuration } : {}),
      isActive: input.isActive,
      createdAt: todayIsoDate()
    };
    return writeCollectionDocument(userId, "workoutTemplates", template);
  },

  async listWorkoutTemplatesByUser(userId: string): Promise<WorkoutTemplate[]> {
    const items = await listCollection<WorkoutTemplate>(userId, "workoutTemplates");
    return sortByCreatedAtDesc(items);
  },

  async updateWorkoutTemplate(
    userId: string,
    id: string,
    updates: Partial<Pick<WorkoutTemplate, "label" | "isActive" | "defaultDuration">>
  ): Promise<WorkoutTemplate | null> {
    return updateCollectionDocument<WorkoutTemplate>(userId, "workoutTemplates", id, updates);
  },

  async deleteWorkoutTemplate(userId: string, id: string): Promise<boolean> {
    const updated = await this.updateWorkoutTemplate(userId, id, { isActive: false });
    return updated !== null;
  },

  async getReminderSettings(userId: string): Promise<ReminderSettings | null> {
    const items = await listCollection<ReminderSettings>(userId, "reminderSettings");
    return [...items].sort((left, right) => compareByDateDesc(left.updatedAt, right.updatedAt))[0] ?? null;
  },

  async upsertReminderSettings(
    userId: string,
    input: Omit<ReminderSettings, "id" | "userId" | "createdAt" | "updatedAt">
  ): Promise<ReminderSettings> {
    const existing = await this.getReminderSettings(userId);
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
    return writeCollectionDocument(userId, "reminderSettings", next);
  },

  async updateMealLog(
    userId: string,
    id: string,
    updates: Partial<Pick<MealLog, "date" | "mealType" | "foodLabel" | "portionSize">>
  ): Promise<MealLog | null> {
    return updateCollectionDocument<MealLog>(userId, "mealLogs", id, updates);
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
        | "workoutSlot"
        | "completed"
        | "templateId"
        | "sets"
        | "reps"
        | "weightKg"
        | "durationMinutes"
        | "intensity"
      >
    >
  ): Promise<WorkoutLog | null> {
    return updateCollectionDocument<WorkoutLog>(userId, "workoutLogs", id, updates);
  },

  async updateBodyMetric(
    userId: string,
    id: string,
    updates: Partial<Pick<BodyMetric, "date" | "weightKg" | "bodyFatPct">>
  ): Promise<BodyMetric | null> {
    return updateCollectionDocument<BodyMetric>(userId, "bodyMetrics", id, updates);
  },

  async upsertGoal(userId: string, input: Omit<GoalInput, "sessionId">): Promise<Goal> {
    const existing = (await listGoals(userId))[0] ?? null;
    const next: Goal = {
      id: existing?.id ?? createId("goal"),
      userId,
      weeklyRoutineTarget: input.weeklyRoutineTarget,
      createdAt: existing?.createdAt ?? nowIso(),
      ...(input.dDay !== undefined ? { dDay: input.dDay } : {}),
      ...(input.targetWeightKg !== undefined ? { targetWeightKg: input.targetWeightKg } : {}),
      ...(input.targetBodyFat !== undefined ? { targetBodyFat: input.targetBodyFat } : {})
    };
    return writeCollectionDocument(userId, "goals", next);
  },

  async listMealsByUser(userId: string): Promise<MealLog[]> {
    return listMealLogs(userId);
  },

  async listMealsByUserInRange(userId: string, from: string, to: string): Promise<MealLog[]> {
    return (await listMealLogs(userId)).filter((item) => inDateRange(item.date, from, to));
  },

  async listWorkoutsByUser(userId: string): Promise<WorkoutLog[]> {
    return listWorkoutLogs(userId);
  },

  async listWorkoutsByUserInRange(userId: string, from: string, to: string): Promise<WorkoutLog[]> {
    return (await listWorkoutLogs(userId)).filter((item) => inDateRange(item.date, from, to));
  },

  async listBodyMetricsByUser(userId: string): Promise<BodyMetric[]> {
    return listBodyMetrics(userId);
  },

  async listBodyMetricsByUserInRange(userId: string, from: string, to: string): Promise<BodyMetric[]> {
    return (await listBodyMetrics(userId)).filter((item) => inDateRange(item.date, from, to));
  },

  async listGoalsByUser(userId: string): Promise<Goal[]> {
    return listGoals(userId);
  },

  async clear(): Promise<void> {
    // Firestore-backed mode is not used in the unit test suite yet, so keep cleanup as a no-op.
  },

  async evaluateReminder(userId: string, date: string): Promise<ReminderEvaluation> {
    const [mealCheckins, workoutLogs, bodyMetrics] = await Promise.all([
      this.listMealCheckinsByUserInRange(userId, date, date),
      this.listWorkoutsByUserInRange(userId, date, date),
      this.listBodyMetricsByUserInRange(userId, date, date)
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
  }
};
