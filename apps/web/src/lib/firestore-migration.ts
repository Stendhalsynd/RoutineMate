import type {
  AuthProvider,
  BodyMetric,
  Goal,
  MealCheckin,
  MealLog,
  MealTemplate,
  ReminderSettings,
  Session,
  WorkoutLog,
  WorkoutTemplate
} from "@routinemate/domain";

import {
  userDocPath,
  userSubdocumentPath,
  type FirestoreUserSubcollection
} from "./firestore-schema";

export type NotionMigrationSource = {
  sessions: Session[];
  mealLogs: MealLog[];
  mealCheckins: MealCheckin[];
  workoutLogs: WorkoutLog[];
  bodyMetrics: BodyMetric[];
  goals: Goal[];
  mealTemplates: MealTemplate[];
  workoutTemplates: WorkoutTemplate[];
  reminderSettings: ReminderSettings[];
};

const MIGRATION_COUNTER_KEYS = [
  "sessions",
  "mealLogs",
  "mealCheckins",
  "workoutLogs",
  "bodyMetrics",
  "goals",
  "mealTemplates",
  "workoutTemplates",
  "reminderSettings"
] as const;

type MigrationCounterKey = (typeof MIGRATION_COUNTER_KEYS)[number];
type MigrationRecordKey = Exclude<MigrationCounterKey, "sessions">;

type MigrationRecordMap = {
  mealLogs: MealLog;
  mealCheckins: MealCheckin;
  workoutLogs: WorkoutLog;
  bodyMetrics: BodyMetric;
  goals: Goal;
  mealTemplates: MealTemplate;
  workoutTemplates: WorkoutTemplate;
  reminderSettings: ReminderSettings;
};

export type MigrationParityCount = {
  source: number;
  target: number;
};

export type MigrationParityCounts = Record<MigrationCounterKey, MigrationParityCount>;

export type FirestoreUserDocument = {
  uid: string;
  legacyUserId: string;
  sessionIds: string[];
  sessionCount: number;
  isGuest: boolean;
  authProvider: AuthProvider;
  createdAt: string;
  source: "notion";
  migratedAt: string;
  primarySessionId?: string;
  upgradedAt?: string;
  email?: string;
  providerSubject?: string;
  avatarUrl?: string;
};

export type FirestoreMigrationWrite = {
  path: string;
  data: Record<string, unknown>;
  merge: true;
  entity: MigrationRecordKey;
  userId: string;
  documentId: string;
};

export type FirestoreUserWrite = {
  path: string;
  data: FirestoreUserDocument;
  merge: true;
};

export type FirestoreMigrationUserPlan = {
  userId: string;
  user: FirestoreUserWrite;
  writes: FirestoreMigrationWrite[];
};

export type FirestoreMigrationPlan = {
  migratedAt: string;
  users: FirestoreMigrationUserPlan[];
  writeCount: number;
};

export type MigrationParityReport = {
  users: Array<{
    userId: string;
    counts: MigrationParityCounts;
  }>;
  totals: MigrationParityCounts;
};

function compareIsoLike(a: string, b: string): number {
  const parsedA = Date.parse(a);
  const parsedB = Date.parse(b);

  if (Number.isFinite(parsedA) && Number.isFinite(parsedB) && parsedA !== parsedB) {
    return parsedA - parsedB;
  }

  return a.localeCompare(b);
}

function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((left, right) => {
    const timestampOrder = compareIsoLike(left.createdAt, right.createdAt);
    if (timestampOrder !== 0) {
      return timestampOrder;
    }
    return left.sessionId.localeCompare(right.sessionId);
  });
}

function sortRecords<T extends { id: string; createdAt?: string; date?: string }>(records: T[]): T[] {
  return [...records].sort((left, right) => {
    const leftKey = left.createdAt ?? left.date ?? "";
    const rightKey = right.createdAt ?? right.date ?? "";
    const timestampOrder = compareIsoLike(leftKey, rightKey);
    if (timestampOrder !== 0) {
      return timestampOrder;
    }
    return left.id.localeCompare(right.id);
  });
}

function pickPrimarySession(sessions: Session[]): Session | null {
  if (sessions.length === 0) {
    return null;
  }

  return [...sessions].sort((left, right) => {
    if (left.isGuest !== right.isGuest) {
      return left.isGuest ? 1 : -1;
    }

    const leftKey = left.upgradedAt ?? left.createdAt;
    const rightKey = right.upgradedAt ?? right.createdAt;
    const timestampOrder = compareIsoLike(rightKey, leftKey);
    if (timestampOrder !== 0) {
      return timestampOrder;
    }

    return left.sessionId.localeCompare(right.sessionId);
  })[0] ?? null;
}

function earliestKnownTimestamp(userId: string, source: NotionMigrationSource, fallback: string): string {
  const timestamps: string[] = [];

  for (const session of source.sessions) {
    if (session.userId === userId) {
      timestamps.push(session.createdAt);
    }
  }

  const recordGroups: MigrationRecordKey[] = [
    "mealLogs",
    "mealCheckins",
    "workoutLogs",
    "bodyMetrics",
    "goals",
    "mealTemplates",
    "workoutTemplates",
    "reminderSettings"
  ];
  for (const key of recordGroups) {
    for (const record of source[key]) {
      if (record.userId === userId) {
        timestamps.push(record.createdAt);
      }
    }
  }

  if (timestamps.length === 0) {
    return fallback;
  }

  return [...timestamps].sort(compareIsoLike)[0] ?? fallback;
}

function createEmptyCounts(): MigrationParityCounts {
  return {
    sessions: { source: 0, target: 0 },
    mealLogs: { source: 0, target: 0 },
    mealCheckins: { source: 0, target: 0 },
    workoutLogs: { source: 0, target: 0 },
    bodyMetrics: { source: 0, target: 0 },
    goals: { source: 0, target: 0 },
    mealTemplates: { source: 0, target: 0 },
    workoutTemplates: { source: 0, target: 0 },
    reminderSettings: { source: 0, target: 0 }
  };
}

function buildUserDocument(
  userId: string,
  sessions: Session[],
  source: NotionMigrationSource,
  migratedAt: string
): FirestoreUserDocument {
  const orderedSessions = sortSessions(sessions);
  const primarySession = pickPrimarySession(orderedSessions);

  const document: FirestoreUserDocument = {
    uid: userId,
    legacyUserId: userId,
    sessionIds: orderedSessions.map((session) => session.sessionId),
    sessionCount: orderedSessions.length,
    isGuest: primarySession?.isGuest ?? true,
    authProvider: primarySession?.authProvider ?? "guest",
    createdAt: orderedSessions[0]?.createdAt ?? earliestKnownTimestamp(userId, source, migratedAt),
    source: "notion",
    migratedAt
  };

  if (primarySession?.sessionId) {
    document.primarySessionId = primarySession.sessionId;
  }
  if (primarySession?.upgradedAt) {
    document.upgradedAt = primarySession.upgradedAt;
  }
  if (primarySession?.email) {
    document.email = primarySession.email;
  }
  if (primarySession?.providerSubject) {
    document.providerSubject = primarySession.providerSubject;
  }
  if (primarySession?.avatarUrl) {
    document.avatarUrl = primarySession.avatarUrl;
  }

  return document;
}

function buildRecordWrites<Key extends MigrationRecordKey>(
  userId: string,
  entity: Key,
  records: MigrationRecordMap[Key][],
  migratedAt: string
): FirestoreMigrationWrite[] {
  const collection = entity as FirestoreUserSubcollection;

  return sortRecords(records).map((record) => {
    const data = structuredClone(record) as unknown as Record<string, unknown>;
    data.source = "notion";
    data.migratedAt = migratedAt;

    return {
      path: userSubdocumentPath(userId, collection, record.id),
      data,
      merge: true,
      entity,
      userId,
      documentId: record.id
    };
  });
}

export function buildFirestoreMigrationPlan(
  source: NotionMigrationSource,
  options?: { migratedAt?: string }
): FirestoreMigrationPlan {
  const migratedAt = options?.migratedAt ?? new Date().toISOString();
  const userIds = new Set<string>();

  for (const key of MIGRATION_COUNTER_KEYS) {
    for (const record of source[key]) {
      userIds.add(record.userId);
    }
  }

  const users = [...userIds]
    .sort((left, right) => left.localeCompare(right))
    .map((userId): FirestoreMigrationUserPlan => {
      const sessions = source.sessions.filter((session) => session.userId === userId);
      const mealLogs = source.mealLogs.filter((record) => record.userId === userId);
      const mealCheckins = source.mealCheckins.filter((record) => record.userId === userId);
      const workoutLogs = source.workoutLogs.filter((record) => record.userId === userId);
      const bodyMetrics = source.bodyMetrics.filter((record) => record.userId === userId);
      const goals = source.goals.filter((record) => record.userId === userId);
      const mealTemplates = source.mealTemplates.filter((record) => record.userId === userId);
      const workoutTemplates = source.workoutTemplates.filter((record) => record.userId === userId);
      const reminderSettings = source.reminderSettings.filter((record) => record.userId === userId);

      const writes = [
        ...buildRecordWrites(userId, "mealLogs", mealLogs, migratedAt),
        ...buildRecordWrites(userId, "mealCheckins", mealCheckins, migratedAt),
        ...buildRecordWrites(userId, "workoutLogs", workoutLogs, migratedAt),
        ...buildRecordWrites(userId, "bodyMetrics", bodyMetrics, migratedAt),
        ...buildRecordWrites(userId, "goals", goals, migratedAt),
        ...buildRecordWrites(userId, "mealTemplates", mealTemplates, migratedAt),
        ...buildRecordWrites(userId, "workoutTemplates", workoutTemplates, migratedAt),
        ...buildRecordWrites(userId, "reminderSettings", reminderSettings, migratedAt)
      ];

      return {
        userId,
        user: {
          path: userDocPath(userId),
          data: buildUserDocument(userId, sessions, source, migratedAt),
          merge: true
        },
        writes
      };
    });

  const writeCount = users.reduce((total, userPlan) => total + 1 + userPlan.writes.length, 0);

  return {
    migratedAt,
    users,
    writeCount
  };
}

function sourceCountForUser(
  source: NotionMigrationSource,
  userId: string,
  key: MigrationCounterKey
): number {
  return source[key].filter((record) => record.userId === userId).length;
}

function targetCountForUser(plan: FirestoreMigrationUserPlan, key: MigrationCounterKey): number {
  if (key === "sessions") {
    return plan.user.data.sessionCount;
  }

  return plan.writes.filter((write) => write.entity === key).length;
}

export function createMigrationParityReport(
  source: NotionMigrationSource,
  plan: FirestoreMigrationPlan
): MigrationParityReport {
  const totals = createEmptyCounts();

  const users = plan.users.map((userPlan) => {
    const counts = createEmptyCounts();

    for (const key of MIGRATION_COUNTER_KEYS) {
      counts[key] = {
        source: sourceCountForUser(source, userPlan.userId, key),
        target: targetCountForUser(userPlan, key)
      };
      totals[key] = {
        source: totals[key].source + counts[key].source,
        target: totals[key].target + counts[key].target
      };
    }

    return {
      userId: userPlan.userId,
      counts
    };
  });

  return {
    users,
    totals
  };
}
