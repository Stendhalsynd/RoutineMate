import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "routinemate.session.id";

export async function readStoredSessionId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    return null;
  }
}

export async function persistSessionId(sessionId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, sessionId);
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
