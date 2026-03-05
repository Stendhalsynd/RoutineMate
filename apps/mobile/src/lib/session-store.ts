import * as SecureStore from "expo-secure-store";

export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const SESSION_KEY = "routinemate.session.meta";
const SESSION_KEY_LEGACY = "routinemate.session.id";

type StoredSession = {
  sessionId: string;
  savedAt: number;
};

function nowIso(): number {
  return Date.now();
}

function serialize(sessionId: string): string {
  const payload: StoredSession = {
    sessionId,
    savedAt: nowIso()
  };
  return JSON.stringify(payload);
}

export async function readStoredSessionId(): Promise<string | null> {
  try {
    const storedMeta = await SecureStore.getItemAsync(SESSION_KEY);
    const parsedNew = parseStoredSession(storedMeta);
    if (parsedNew) {
      if (nowIso() - parsedNew.savedAt > SESSION_TTL_MS) {
        await clearStoredSessionId();
        return null;
      }
      return parsedNew.sessionId;
    }

    const legacyStored = await SecureStore.getItemAsync(SESSION_KEY_LEGACY);
    const parsedLegacy = parseStoredSession(legacyStored);
    if (parsedLegacy && parsedLegacy.sessionId) {
      if (nowIso() - parsedLegacy.savedAt > SESSION_TTL_MS) {
        await clearStoredSessionId();
        return null;
      }
      await persistSessionId(parsedLegacy.sessionId);
      return parsedLegacy.sessionId;
    }

    if (typeof legacyStored === "string" && legacyStored.trim().length > 0) {
      await persistSessionId(legacyStored);
      return legacyStored;
    }

    if (typeof storedMeta === "string" && storedMeta.trim().length > 0) {
      await persistSessionId(storedMeta);
      return storedMeta;
    }

    return null;
  } catch {
    return null;
  }
}

export async function persistSessionId(sessionId: string): Promise<void> {
  try {
    await Promise.all([
      SecureStore.setItemAsync(SESSION_KEY, serialize(sessionId)),
      // Legacy key kept for backward compatibility with previous app versions.
      SecureStore.setItemAsync(SESSION_KEY_LEGACY, sessionId)
    ]);
  } catch {
    // ignore secure storage failures and continue with cookie/session fallback.
  }
}

export async function clearStoredSessionId(): Promise<void> {
  try {
    await Promise.all([SecureStore.deleteItemAsync(SESSION_KEY), SecureStore.deleteItemAsync(SESSION_KEY_LEGACY)]);
  } catch {
    // ignore cleanup failures.
  }
}

function parseStoredSession(raw: string | null): StoredSession | null {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed?.sessionId === "string" &&
      typeof parsed?.savedAt === "number" &&
      Number.isFinite(parsed.savedAt)
    ) {
      return {
        sessionId: parsed.sessionId,
        savedAt: parsed.savedAt
      };
    }
    return null;
  } catch {
    return null;
  }
}
