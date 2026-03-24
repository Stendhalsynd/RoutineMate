import * as SecureStore from "expo-secure-store";

import {
  parseBootstrapCache,
  serializeBootstrapCache,
  type StoredBootstrapCache
} from "./bootstrap-cache";

const BOOTSTRAP_CACHE_KEY = "routinemate.bootstrap.cache.v1";

export async function readStoredBootstrapCache(): Promise<StoredBootstrapCache | null> {
  try {
    const raw = await SecureStore.getItemAsync(BOOTSTRAP_CACHE_KEY);
    return parseBootstrapCache(raw);
  } catch {
    return null;
  }
}

export async function persistBootstrapCache(cache: StoredBootstrapCache): Promise<void> {
  try {
    await SecureStore.setItemAsync(BOOTSTRAP_CACHE_KEY, serializeBootstrapCache(cache));
  } catch {
    // ignore storage failures and continue with network-backed flow.
  }
}

export async function clearStoredBootstrapCache(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BOOTSTRAP_CACHE_KEY);
  } catch {
    // ignore cleanup failures.
  }
}
