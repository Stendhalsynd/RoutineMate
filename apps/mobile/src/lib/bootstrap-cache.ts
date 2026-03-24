export const BOOTSTRAP_CACHE_TTL_MS = 15 * 60 * 1000;

export type StoredSessionSnapshot = {
  sessionId: string;
  userId: string;
  isGuest: boolean;
  createdAt: string;
  upgradedAt?: string;
  email?: string;
  authProvider?: string;
  providerSubject?: string;
  avatarUrl?: string;
};

export type StoredBootstrapPayload = {
  session: StoredSessionSnapshot | null;
  fetchedAt: string;
  dashboard?: Record<string, unknown>;
  day?: {
    date: string;
    mealCheckins: unknown[];
    workoutLogs: unknown[];
    bodyMetrics: unknown[];
  };
  goal?: Record<string, unknown> | null;
  mealTemplates?: Array<Record<string, unknown>>;
  workoutTemplates?: Array<Record<string, unknown>>;
  reminderSettings?: Record<string, unknown> | null;
};

export type BootstrapCacheView = "dashboard" | "records" | "settings";

export type StoredBootstrapCache = {
  session: StoredSessionSnapshot;
  bootstrapByView: Partial<Record<BootstrapCacheView, StoredBootstrapPayload>>;
  validatedAt: number;
};

export function serializeBootstrapCache(cache: StoredBootstrapCache): string {
  return JSON.stringify(cache);
}

export function parseBootstrapCache(raw: string | null): StoredBootstrapCache | null {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredBootstrapCache>;
    if (!isStoredSessionSnapshot(parsed.session) || !isBootstrapPayloadRecord(parsed.bootstrapByView)) {
      return null;
    }
    if (typeof parsed.validatedAt !== "number" || !Number.isFinite(parsed.validatedAt)) {
      return null;
    }
    return {
      session: parsed.session,
      bootstrapByView: parsed.bootstrapByView,
      validatedAt: parsed.validatedAt
    };
  } catch {
    return null;
  }
}

export function isBootstrapCacheFresh(cache: StoredBootstrapCache, now = Date.now()): boolean {
  return now - cache.validatedAt <= BOOTSTRAP_CACHE_TTL_MS;
}

function isStoredSessionSnapshot(value: unknown): value is StoredSessionSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<StoredSessionSnapshot>;
  return (
    typeof candidate.sessionId === "string" &&
    candidate.sessionId.length > 0 &&
    typeof candidate.userId === "string" &&
    candidate.userId.length > 0 &&
    typeof candidate.isGuest === "boolean" &&
    typeof candidate.createdAt === "string" &&
    candidate.createdAt.length > 0
  );
}

function isStoredBootstrapPayload(value: unknown): value is StoredBootstrapPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<StoredBootstrapPayload>;
  if (candidate.session !== null && candidate.session !== undefined && !isStoredSessionSnapshot(candidate.session)) {
    return false;
  }
  if (typeof candidate.fetchedAt !== "string" || candidate.fetchedAt.length === 0) {
    return false;
  }
  if (candidate.day !== undefined) {
    if (
      !candidate.day ||
      typeof candidate.day !== "object" ||
      typeof candidate.day.date !== "string" ||
      !Array.isArray(candidate.day.mealCheckins) ||
      !Array.isArray(candidate.day.workoutLogs) ||
      !Array.isArray(candidate.day.bodyMetrics)
    ) {
      return false;
    }
  }
  return true;
}

function isBootstrapPayloadRecord(
  value: unknown
): value is Partial<Record<BootstrapCacheView, StoredBootstrapPayload>> {
  if (!value || typeof value !== "object") {
    return false;
  }
  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (!isStoredBootstrapPayload(entry)) {
      return false;
    }
  }
  return true;
}
