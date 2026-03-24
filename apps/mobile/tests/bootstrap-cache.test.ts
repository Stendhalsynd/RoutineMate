import assert from "node:assert/strict";
import test from "node:test";

import {
  BOOTSTRAP_CACHE_TTL_MS,
  isBootstrapCacheFresh,
  parseBootstrapCache,
  serializeBootstrapCache,
  type StoredBootstrapCache
} from "../src/lib/bootstrap-cache";

const baseCache: StoredBootstrapCache = {
  session: {
    sessionId: "sess_123",
    userId: "user_123",
    isGuest: false,
    createdAt: "2026-03-24T00:00:00.000Z",
    email: "user@example.com",
    authProvider: "google"
  },
  bootstrapByView: {
    records: {
      session: {
        sessionId: "sess_123",
        userId: "user_123",
        isGuest: false,
        createdAt: "2026-03-24T00:00:00.000Z",
        email: "user@example.com",
        authProvider: "google"
      },
      fetchedAt: "2026-03-24T00:00:01.000Z",
      dashboard: {
        adherenceRate: 80,
        totalMeals: 2,
        totalWorkouts: 1,
        range: "7d",
        granularity: "day",
        bodyMetricTrend: [],
        buckets: []
      },
      day: {
        date: "2026-03-24",
        mealCheckins: [],
        workoutLogs: [],
        bodyMetrics: []
      },
      goal: {
        id: "goal_1",
        userId: "user_123",
        weeklyRoutineTarget: 4,
        createdAt: "2026-03-24T00:00:00.000Z"
      },
      mealTemplates: [],
      workoutTemplates: [],
      reminderSettings: null
    }
  },
  validatedAt: 1_711_234_567_890
};

test("serializeBootstrapCache round-trips stored provisional session payload", () => {
  const serialized = serializeBootstrapCache(baseCache);
  const parsed = parseBootstrapCache(serialized);

  assert.deepEqual(parsed, baseCache);
});

test("parseBootstrapCache returns null for malformed payloads", () => {
  assert.equal(parseBootstrapCache("{"), null);
  assert.equal(parseBootstrapCache(""), null);
  assert.equal(parseBootstrapCache(JSON.stringify({ foo: "bar" })), null);
});

test("isBootstrapCacheFresh rejects stale provisional cache", () => {
  const staleValidatedAt = Date.now() - BOOTSTRAP_CACHE_TTL_MS - 1;
  assert.equal(isBootstrapCacheFresh({ ...baseCache, validatedAt: staleValidatedAt }, Date.now()), false);
});

test("isBootstrapCacheFresh accepts recent provisional cache", () => {
  const freshValidatedAt = Date.now() - Math.floor(BOOTSTRAP_CACHE_TTL_MS / 2);
  assert.equal(isBootstrapCacheFresh({ ...baseCache, validatedAt: freshValidatedAt }, Date.now()), true);
});
