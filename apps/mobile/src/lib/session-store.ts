import * as SecureStore from "expo-secure-store";

export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const SESSION_KEY = "routinemate.session.meta";

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
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as StoredSession;
      if (!parsed?.sessionId || typeof parsed.savedAt !== "number" || !Number.isFinite(parsed.savedAt)) {
        throw new Error("legacy");
      }
      if (nowIso() - parsed.savedAt > SESSION_TTL_MS) {
        await clearStoredSessionId();
        return null;
      }
      return parsed.sessionId;
    } catch (error) {
      if (typeof raw === "string" && raw.trim().length > 0) {
        await persistSessionId(raw);
        return raw;
      }
      await clearStoredSessionId();
      return null;
    }
  } catch {
    return null;
  }
}

export async function persistSessionId(sessionId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, serialize(sessionId));
  } catch {
    // ignore secure storage failures and continue with cookie/session fallback.
  }
}

export async function clearStoredSessionId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // ignore cleanup failures.
  }
}
