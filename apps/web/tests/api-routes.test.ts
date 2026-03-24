import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { POST as createGuest } from "../app/api/v1/auth/guest/route";
import { POST as createGoogleSession } from "../app/api/v1/auth/google/session/route";
import { GET as getAuthSession } from "../app/api/v1/auth/session/route";
import { POST as createBodyMetric, PATCH as updateBodyMetric } from "../app/api/v1/body-metrics/route";
import { GET as getCalendarDay } from "../app/api/v1/calendar/day/route";
import { GET as getBootstrap } from "../app/api/v1/bootstrap/route";
import { GET as getDashboard } from "../app/api/v1/dashboard/route";
import { POST as upsertGoal } from "../app/api/v1/goals/route";
import { POST as upgradeGoogleSession } from "../app/api/v1/auth/upgrade/google/route";
import { POST as createMeal, PATCH as updateMeal } from "../app/api/v1/meal-logs/quick/route";
import { POST as createMealCheckin } from "../app/api/v1/meal-checkins/route";
import { PATCH as patchMealCheckin, DELETE as deleteMealCheckin } from "../app/api/v1/meal-checkins/[id]/route";
import { GET as evaluateReminder } from "../app/api/v1/reminders/evaluate/route";
import { GET as getReminderSettings, POST as saveReminderSettings } from "../app/api/v1/reminders/settings/route";
import { GET as getMealTemplates, POST as createMealTemplate } from "../app/api/v1/templates/meals/route";
import {
  PATCH as patchMealTemplate,
  DELETE as deleteMealTemplate
} from "../app/api/v1/templates/meals/[id]/route";
import { GET as getWorkoutTemplates, POST as createWorkoutTemplate } from "../app/api/v1/templates/workouts/route";
import {
  PATCH as patchWorkoutTemplate,
  DELETE as deleteWorkoutTemplate
} from "../app/api/v1/templates/workouts/[id]/route";
import { POST as createWorkout, PATCH as updateWorkout } from "../app/api/v1/workout-logs/quick/route";
import { POST as createWorkoutCheckin } from "../app/api/v1/workout-checkins/route";
import {
  PATCH as patchWorkoutCheckin,
  DELETE as deleteWorkoutCheckin
} from "../app/api/v1/workout-checkins/[id]/route";
import { DELETE as deleteWorkout } from "../app/api/v1/workout-logs/[id]/route";
import { DELETE as deleteBodyMetric } from "../app/api/v1/body-metrics/[id]/route";
import { repo } from "../src/lib/repository";
import { SESSION_MAX_AGE_DAYS } from "../src/lib/session-cookie";

type SessionResponse = { data: { sessionId: string; userId: string } };

process.env.GOOGLE_ANDROID_CLIENT_ID = process.env.GOOGLE_ANDROID_CLIENT_ID ?? "test-android-client-id";
process.env.GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID ?? "test-web-client-id";

async function makeSession(): Promise<SessionResponse["data"]> {
  const sessionResponse = await createGuest(
    new Request("http://localhost/api/v1/auth/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })
  );

  assert.equal(sessionResponse.status, 201);
  const sessionPayload = (await sessionResponse.json()) as SessionResponse;
  return sessionPayload.data;
}

async function createActiveMealTemplateForSlot(
  sessionId: string,
  mealSlot: "breakfast" | "lunch" | "dinner" | "dinner2",
  label = "기본 식단 템플릿"
): Promise<{ id: string }> {
  const response = await createMealTemplate(
    new Request("http://localhost/api/v1/templates/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        label,
        mealSlot,
        isActive: true
      })
    })
  );
  assert.equal(response.status, 201);
  const payload = (await response.json()) as { data: { id: string } };
  return payload.data;
}

beforeEach(async () => {
  await repo.clear();
});

test("POST /v1/auth/guest creates a guest session", async () => {
  const response = await createGuest(
    new Request("http://localhost/api/v1/auth/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })
  );

  assert.equal(response.status, 201);
  const payload = (await response.json()) as { data: { sessionId: string; userId: string } };
  assert.equal(typeof payload.data.sessionId, "string");
  assert.equal(typeof payload.data.userId, "string");
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.ok(setCookie.includes("routinemate_session_id="));
  assert.equal(setCookie.includes("Secure"), false);
  assert.ok(setCookie.includes(`Max-Age=${SESSION_MAX_AGE_DAYS * 24 * 60 * 60}`));
});

test("GET /v1/auth/session restores session from cookie and returns null without cookie", async () => {
  const session = await makeSession();

  const missing = await getAuthSession(new Request("http://localhost/api/v1/auth/session"));
  assert.equal(missing.status, 200);
  const missingPayload = (await missing.json()) as { data: null };
  assert.equal(missingPayload.data, null);

  const restored = await getAuthSession(
    new Request("http://localhost/api/v1/auth/session", {
      headers: {
        cookie: `routinemate_session_id=${session.sessionId}`
      }
    })
  );
  assert.equal(restored.status, 200);
  const restoredPayload = (await restored.json()) as { data: { sessionId: string } };
  assert.equal(restoredPayload.data.sessionId, session.sessionId);

  const byQuery = await getAuthSession(
    new Request(`http://localhost/api/v1/auth/session?sessionId=${encodeURIComponent(session.sessionId)}`)
  );
  assert.equal(byQuery.status, 200);
  const byQueryPayload = (await byQuery.json()) as { data: { sessionId: string } };
  assert.equal(byQueryPayload.data.sessionId, session.sessionId);
});

test("GET /v1/auth/session does not canonicalize google session during read", async () => {
  const restoredResponse = await createGoogleSession(
    new Request("http://localhost/api/v1/auth/google/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: "test:google-sub-fast:user-fast@example.com",
        platform: "android"
      })
    })
  );
  assert.equal(restoredResponse.status, 200);
  const restoredPayload = (await restoredResponse.json()) as {
    data: { sessionId: string };
  };

  let called = false;
  const original = repo.resolveCanonicalGoogleSession;
  repo.resolveCanonicalGoogleSession = (async () => {
    called = true;
    throw new Error("resolveCanonicalGoogleSession should not be called by GET /v1/auth/session");
  }) as typeof repo.resolveCanonicalGoogleSession;

  try {
    const response = await getAuthSession(
      new Request("http://localhost/api/v1/auth/session", {
        headers: {
          cookie: `routinemate_session_id=${restoredPayload.data.sessionId}`
        }
      })
    );
    assert.equal(response.status, 200);
    assert.equal(called, false);
  } finally {
    repo.resolveCanonicalGoogleSession = original;
  }
});

test("POST /v1/auth/upgrade/google upgrades session and POST /v1/auth/google/session restores it", async () => {
  const session = await makeSession();

  const upgradedResponse = await upgradeGoogleSession(
    new Request("http://localhost/api/v1/auth/upgrade/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        idToken: "test:google-sub-1:user1@example.com",
        platform: "web"
      })
    })
  );

  assert.equal(upgradedResponse.status, 200);
  const upgradedPayload = (await upgradedResponse.json()) as {
    data: { isGuest: boolean; authProvider?: string; providerSubject?: string; email?: string };
  };
  assert.equal(upgradedPayload.data.isGuest, false);
  assert.equal(upgradedPayload.data.authProvider, "google");
  assert.equal(upgradedPayload.data.providerSubject, "google-sub-1");
  assert.equal(upgradedPayload.data.email, "user1@example.com");

  const restoredResponse = await createGoogleSession(
    new Request("http://localhost/api/v1/auth/google/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: "test:google-sub-1:user1@example.com",
        platform: "android"
      })
    })
  );
  assert.equal(restoredResponse.status, 200);
  const restoredPayload = (await restoredResponse.json()) as {
    data: { userId: string; authProvider?: string };
  };
  assert.equal(restoredPayload.data.userId, session.userId);
  assert.equal(restoredPayload.data.authProvider, "google");
});

test("POST /v1/auth/upgrade/google accepts auth code + PKCE flow", async () => {
  const session = await makeSession();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({
          id_token: "test:google-sub-2:user2@example.com"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const upgradedResponse = await upgradeGoogleSession(
      new Request("http://localhost/api/v1/auth/upgrade/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          authorizationCode: "auth-code",
          codeVerifier: "verifier",
          redirectUri: "routinemate://oauth",
          platform: "android"
        })
      })
    );
    assert.equal(upgradedResponse.status, 200);

    const restoredResponse = await createGoogleSession(
      new Request("http://localhost/api/v1/auth/google/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorizationCode: "auth-code",
          codeVerifier: "verifier",
          redirectUri: "routinemate://oauth",
          platform: "android"
        })
      })
    );

    assert.equal(restoredResponse.status, 200);
    const restoredPayload = (await restoredResponse.json()) as {
      data: { userId: string; authProvider?: string };
    };
    assert.equal(restoredPayload.data.userId, session.userId);
    assert.equal(restoredPayload.data.authProvider, "google");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("POST /v1/auth/google/session accepts native_sdk token with web aud + android azp", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.startsWith("https://oauth2.googleapis.com/tokeninfo")) {
      return new Response(
        JSON.stringify({
          sub: "google-native-sub",
          email: "native-user@example.com",
          email_verified: "true",
          aud: "test-web-client-id",
          azp: "test-android-client-id"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const response = await createGoogleSession(
      new Request("http://localhost/api/v1/auth/google/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken: "opaque-native-token",
          platform: "android",
          mode: "native_sdk"
        })
      })
    );
    assert.equal(response.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("POST /v1/auth/google/session rejects native_sdk token when azp mismatches Android client", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.startsWith("https://oauth2.googleapis.com/tokeninfo")) {
      return new Response(
        JSON.stringify({
          sub: "google-native-sub",
          email: "native-user@example.com",
          email_verified: "true",
          aud: "test-web-client-id",
          azp: "mismatched-android-client-id"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const response = await createGoogleSession(
      new Request("http://localhost/api/v1/auth/google/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken: "opaque-native-token",
          platform: "android",
          mode: "native_sdk"
        })
      })
    );
    assert.equal(response.status, 500);
    const payload = (await response.json()) as { error?: { message?: string } };
    assert.equal(payload.error?.message, "허용되지 않은 Google Android OAuth 클라이언트입니다.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google 중복 세션이 canonical userId로 자동 통합되고 이후 /v1/auth/session은 현재 sessionId를 그대로 읽는다", async () => {
  const firstGuest = await makeSession();
  const firstUpgradeResponse = await upgradeGoogleSession(
    new Request("http://localhost/api/v1/auth/upgrade/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: firstGuest.sessionId,
        idToken: "test:google-merge-sub:merge-user@example.com",
        platform: "web"
      })
    })
  );
  assert.equal(firstUpgradeResponse.status, 200);
  const firstUpgradePayload = (await firstUpgradeResponse.json()) as {
    data: { sessionId: string; userId: string };
  };

  const secondGuest = await makeSession();
  const secondMetricResponse = await createBodyMetric(
    new Request("http://localhost/api/v1/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: secondGuest.sessionId,
        date: "2026-03-03",
        weightKg: 71.2
      })
    })
  );
  assert.equal(secondMetricResponse.status, 201);

  const secondUpgradeResponse = await upgradeGoogleSession(
    new Request("http://localhost/api/v1/auth/upgrade/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: secondGuest.sessionId,
        idToken: "test:google-merge-sub:merge-user@example.com",
        platform: "android"
      })
    })
  );
  assert.equal(secondUpgradeResponse.status, 200);
  const secondUpgradePayload = (await secondUpgradeResponse.json()) as {
    data: { sessionId: string; userId: string };
  };
  assert.equal(secondUpgradePayload.data.userId, firstUpgradePayload.data.userId);
  assert.equal(secondUpgradePayload.data.sessionId, firstUpgradePayload.data.sessionId);

  const canonicalDay = await getCalendarDay(
    new Request(
      `http://localhost/api/v1/calendar/day?sessionId=${encodeURIComponent(secondUpgradePayload.data.sessionId)}&date=2026-03-03`
    )
  );
  assert.equal(canonicalDay.status, 200);
  const canonicalDayPayload = (await canonicalDay.json()) as {
    data: { bodyMetrics: Array<{ weightKg?: number }> };
  };
  assert.equal(canonicalDayPayload.data.bodyMetrics.length, 1);
  assert.equal(canonicalDayPayload.data.bodyMetrics[0]?.weightKg, 71.2);

  const staleCookieSession = await getAuthSession(
    new Request("http://localhost/api/v1/auth/session", {
      headers: {
        cookie: `routinemate_session_id=${secondGuest.sessionId}`
      }
    })
  );
  assert.equal(staleCookieSession.status, 200);
  const stalePayload = (await staleCookieSession.json()) as {
    data: { sessionId: string; userId: string };
  };
  assert.equal(stalePayload.data.sessionId, secondGuest.sessionId);
  assert.equal(stalePayload.data.userId, firstUpgradePayload.data.userId);
  assert.equal(staleCookieSession.headers.get("set-cookie"), null);
});

test("GET /v1/dashboard without sessionId returns 400", async () => {
  const response = await getDashboard(new Request("http://localhost/api/v1/dashboard"));
  assert.equal(response.status, 400);
});

test("GET /v1/dashboard with unknown session returns 404", async () => {
  const response = await getDashboard(new Request("http://localhost/api/v1/dashboard?sessionId=missing&range=7d"));
  assert.equal(response.status, 404);
});

test("GET /v1/dashboard honors date query as local-day range end", async () => {
  const session = await makeSession();

  const workoutResponse = await createWorkout(
    new Request("http://localhost/api/v1/workout-logs/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-04",
        bodyPart: "full_body",
        purpose: "fat_loss",
        tool: "bodyweight",
        exerciseName: "오전 운동",
        workoutSlot: "am",
        completed: true,
        durationMinutes: 30,
        intensity: "medium"
      })
    })
  );
  assert.equal(workoutResponse.status, 201);

  const response = await getDashboard(
    new Request(
      `http://localhost/api/v1/dashboard?sessionId=${encodeURIComponent(session.sessionId)}&range=7d&date=2026-03-04`
    )
  );
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    data: { totalWorkouts: number; consistencyMeta?: { windowEnd?: string } };
  };
  assert.equal(payload.data.totalWorkouts, 1);
  assert.equal(payload.data.consistencyMeta?.windowEnd, "2026-03-04");
});

test("POST /v1/meal-logs/quick rejects impossible date", async () => {
  const session = await makeSession();

  const response = await createMeal(
    new Request("http://localhost/api/v1/meal-logs/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-02-31",
        mealType: "lunch",
        foodLabel: "Bibimbap",
        portionSize: "medium"
      })
    })
  );

  assert.equal(response.status, 400);
});

test("GET /v1/calendar/day returns meal/workout/body records for selected date", async () => {
  const session = await makeSession();

  const mealResponse = await createMeal(
    new Request("http://localhost/api/v1/meal-logs/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-01",
        mealType: "lunch",
        foodLabel: "닭가슴살 샐러드",
        portionSize: "medium"
      })
    })
  );
  assert.equal(mealResponse.status, 201);

  const workoutResponse = await createWorkout(
    new Request("http://localhost/api/v1/workout-logs/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-01",
        bodyPart: "full_body",
        purpose: "fat_loss",
        tool: "bodyweight",
        exerciseName: "서킷 트레이닝",
        durationMinutes: 30,
        intensity: "medium"
      })
    })
  );
  assert.equal(workoutResponse.status, 201);

  const metricResponse = await createBodyMetric(
    new Request("http://localhost/api/v1/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-01",
        weightKg: 72.3,
        bodyFatPct: 19.4
      })
    })
  );
  assert.equal(metricResponse.status, 201);

  const dayResponse = await getCalendarDay(
    new Request(
      `http://localhost/api/v1/calendar/day?sessionId=${encodeURIComponent(session.sessionId)}&date=2026-03-01`
    )
  );
  assert.equal(dayResponse.status, 200);

  const payload = (await dayResponse.json()) as {
    data: {
      mealLogs: Array<{ id: string }>;
      workoutLogs: Array<{ id: string }>;
      bodyMetrics: Array<{ id: string }>;
    };
  };

  assert.equal(payload.data.mealLogs.length, 1);
  assert.equal(payload.data.workoutLogs.length, 1);
  assert.equal(payload.data.bodyMetrics.length, 1);
});

test("PATCH /v1/meal-logs/quick updates a meal log", async () => {
  const session = await makeSession();

  const createdResponse = await createMeal(
    new Request("http://localhost/api/v1/meal-logs/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-01",
        mealType: "lunch",
        foodLabel: "샐러드",
        portionSize: "small"
      })
    })
  );
  const created = (await createdResponse.json()) as { data: { id: string } };

  const patchResponse = await updateMeal(
    new Request("http://localhost/api/v1/meal-logs/quick", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        id: created.data.id,
        foodLabel: "현미 닭가슴살 볼",
        portionSize: "large"
      })
    })
  );

  assert.equal(patchResponse.status, 200);
  const updated = (await patchResponse.json()) as {
    data: { id: string; foodLabel: string; portionSize: string };
  };
  assert.equal(updated.data.id, created.data.id);
  assert.equal(updated.data.foodLabel, "현미 닭가슴살 볼");
  assert.equal(updated.data.portionSize, "large");
});

test("PATCH /v1/meal-logs/quick returns 404 for unknown log id", async () => {
  const session = await makeSession();

  const patchResponse = await updateMeal(
    new Request("http://localhost/api/v1/meal-logs/quick", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        id: "meal_missing",
        foodLabel: "현미밥"
      })
    })
  );

  assert.equal(patchResponse.status, 404);
});

test("PATCH /v1/workout-logs/quick updates a workout log", async () => {
  const session = await makeSession();

  const createdResponse = await createWorkout(
    new Request("http://localhost/api/v1/workout-logs/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-01",
        bodyPart: "legs",
        purpose: "muscle_gain",
        tool: "barbell",
        exerciseName: "스쿼트",
        durationMinutes: 40,
        intensity: "medium"
      })
    })
  );
  const created = (await createdResponse.json()) as { data: { id: string } };

  const patchResponse = await updateWorkout(
    new Request("http://localhost/api/v1/workout-logs/quick", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        id: created.data.id,
        exerciseName: "프론트 스쿼트",
        durationMinutes: 35,
        intensity: "high"
      })
    })
  );

  assert.equal(patchResponse.status, 200);
  const updated = (await patchResponse.json()) as {
    data: { id: string; exerciseName: string; durationMinutes: number; intensity: string };
  };
  assert.equal(updated.data.id, created.data.id);
  assert.equal(updated.data.exerciseName, "프론트 스쿼트");
  assert.equal(updated.data.durationMinutes, 35);
  assert.equal(updated.data.intensity, "high");
});

test("PATCH /v1/workout-logs/quick returns 404 for unknown log id", async () => {
  const session = await makeSession();

  const patchResponse = await updateWorkout(
    new Request("http://localhost/api/v1/workout-logs/quick", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        id: "workout_missing",
        exerciseName: "버피 테스트"
      })
    })
  );

  assert.equal(patchResponse.status, 404);
});

test("PATCH /v1/body-metrics updates a body metric entry", async () => {
  const session = await makeSession();

  const createdResponse = await createBodyMetric(
    new Request("http://localhost/api/v1/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-01",
        weightKg: 72,
        bodyFatPct: 20
      })
    })
  );
  const created = (await createdResponse.json()) as { data: { id: string } };

  const patchResponse = await updateBodyMetric(
    new Request("http://localhost/api/v1/body-metrics", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        id: created.data.id,
        weightKg: 71.4,
        bodyFatPct: 18.8
      })
    })
  );

  assert.equal(patchResponse.status, 200);
  const updated = (await patchResponse.json()) as {
    data: { id: string; weightKg: number; bodyFatPct: number };
  };

  assert.equal(updated.data.id, created.data.id);
  assert.equal(updated.data.weightKg, 71.4);
  assert.equal(updated.data.bodyFatPct, 18.8);
});

test("PATCH /v1/body-metrics returns 404 for unknown log id", async () => {
  const session = await makeSession();

  const patchResponse = await updateBodyMetric(
    new Request("http://localhost/api/v1/body-metrics", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        id: "metric_missing",
        weightKg: 70.2
      })
    })
  );

  assert.equal(patchResponse.status, 404);
});

test("POST/PATCH/DELETE /v1/meal-checkins works with soft delete", async () => {
  const session = await makeSession();
  const mealTemplate = await createActiveMealTemplateForSlot(session.sessionId, "dinner2", "저녁2 테스트 템플릿");

  const createdResponse = await createMealCheckin(
    new Request("http://localhost/api/v1/meal-checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-01",
        slot: "dinner2",
        completed: true,
        templateId: mealTemplate.id
      })
    })
  );
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()) as { data: { id: string; slot: string } };
  assert.equal(created.data.slot, "dinner2");

  const patchedResponse = await patchMealCheckin(
    new Request(`http://localhost/api/v1/meal-checkins/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        completed: false
      })
    }),
    { params: Promise.resolve({ id: created.data.id }) }
  );
  assert.equal(patchedResponse.status, 200);

  const deletedResponse = await deleteMealCheckin(
    new Request(`http://localhost/api/v1/meal-checkins/${created.data.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId })
    }),
    { params: Promise.resolve({ id: created.data.id }) }
  );
  assert.equal(deletedResponse.status, 200);

  const dayResponse = await getCalendarDay(
    new Request(
      `http://localhost/api/v1/calendar/day?sessionId=${encodeURIComponent(session.sessionId)}&date=2026-03-01`
    )
  );
  const dayPayload = (await dayResponse.json()) as {
    data: { mealCheckins: Array<{ id: string }> };
  };
  assert.equal(dayPayload.data.mealCheckins.length, 0);
});

test("POST /v1/meal-checkins는 completed=true일 때 활성 템플릿이 필수다", async () => {
  const session = await makeSession();
  await createActiveMealTemplateForSlot(session.sessionId, "lunch", "점심 템플릿");

  const noTemplateResponse = await createMealCheckin(
    new Request("http://localhost/api/v1/meal-checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-02",
        slot: "lunch",
        completed: true
      })
    })
  );
  assert.equal(noTemplateResponse.status, 400);
  const noTemplatePayload = (await noTemplateResponse.json()) as { error?: { message?: string } };
  assert.equal(noTemplatePayload.error?.message, "활성 식단 템플릿이 필요합니다.");

  const mismatchTemplate = await createActiveMealTemplateForSlot(session.sessionId, "dinner", "저녁 템플릿");
  const mismatchResponse = await createMealCheckin(
    new Request("http://localhost/api/v1/meal-checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-02",
        slot: "lunch",
        completed: true,
        templateId: mismatchTemplate.id
      })
    })
  );
  assert.equal(mismatchResponse.status, 201);
});

test("POST/PATCH/DELETE /v1/workout-checkins works with am/pm slots", async () => {
  const session = await makeSession();
  const workoutTemplateResponse = await createWorkoutTemplate(
    new Request("http://localhost/api/v1/templates/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        label: "오전 루틴",
        bodyPart: "full_body",
        purpose: "fat_loss",
        tool: "bodyweight",
        defaultDuration: 25,
        isActive: true
      })
    })
  );
  assert.equal(workoutTemplateResponse.status, 201);
  const workoutTemplate = (await workoutTemplateResponse.json()) as { data: { id: string } };

  const createdResponse = await createWorkoutCheckin(
    new Request("http://localhost/api/v1/workout-checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-01",
        slot: "am",
        completed: true,
        templateId: workoutTemplate.data.id
      })
    })
  );
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()) as { data: { id: string; workoutSlot: string } };
  assert.equal(created.data.workoutSlot, "am");

  const patchedResponse = await patchWorkoutCheckin(
    new Request(`http://localhost/api/v1/workout-checkins/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        slot: "pm",
        completed: false
      })
    }),
    { params: Promise.resolve({ id: created.data.id }) }
  );
  assert.equal(patchedResponse.status, 200);

  const deletedResponse = await deleteWorkoutCheckin(
    new Request(`http://localhost/api/v1/workout-checkins/${created.data.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId })
    }),
    { params: Promise.resolve({ id: created.data.id }) }
  );
  assert.equal(deletedResponse.status, 200);

  const dayResponse = await getCalendarDay(
    new Request(
      `http://localhost/api/v1/calendar/day?sessionId=${encodeURIComponent(session.sessionId)}&date=2026-03-01`
    )
  );
  const dayPayload = (await dayResponse.json()) as {
    data: { workoutLogs: Array<{ id: string }> };
  };
  assert.equal(dayPayload.data.workoutLogs.length, 0);
});

test("POST /v1/workout-checkins requires active template when completed=true", async () => {
  const session = await makeSession();

  const missingTemplate = await createWorkoutCheckin(
    new Request("http://localhost/api/v1/workout-checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-01",
        slot: "pm",
        completed: true
      })
    })
  );
  assert.equal(missingTemplate.status, 400);
  const missingTemplatePayload = (await missingTemplate.json()) as { error?: { message?: string } };
  assert.equal(missingTemplatePayload.error?.message, "활성 운동 템플릿이 필요합니다.");
});

test("DELETE /v1/workout-logs/:id and /v1/body-metrics/:id soft-delete records", async () => {
  const session = await makeSession();

  const workoutResponse = await createWorkout(
    new Request("http://localhost/api/v1/workout-logs/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-01",
        bodyPart: "full_body",
        purpose: "fat_loss",
        tool: "bodyweight",
        exerciseName: "서킷 트레이닝",
        durationMinutes: 30,
        intensity: "medium"
      })
    })
  );
  const workout = (await workoutResponse.json()) as { data: { id: string } };

  const metricResponse = await createBodyMetric(
    new Request("http://localhost/api/v1/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-01",
        weightKg: 72,
        bodyFatPct: 20
      })
    })
  );
  const metric = (await metricResponse.json()) as { data: { id: string } };

  const deletedWorkout = await deleteWorkout(
    new Request(`http://localhost/api/v1/workout-logs/${workout.data.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId })
    }),
    { params: Promise.resolve({ id: workout.data.id }) }
  );
  assert.equal(deletedWorkout.status, 200);

  const deletedMetric = await deleteBodyMetric(
    new Request(`http://localhost/api/v1/body-metrics/${metric.data.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId })
    }),
    { params: Promise.resolve({ id: metric.data.id }) }
  );
  assert.equal(deletedMetric.status, 200);

  const dayResponse = await getCalendarDay(
    new Request(
      `http://localhost/api/v1/calendar/day?sessionId=${encodeURIComponent(session.sessionId)}&date=2026-03-01`
    )
  );
  const dayPayload = (await dayResponse.json()) as {
    data: { workoutLogs: Array<{ id: string }>; bodyMetrics: Array<{ id: string }> };
  };
  assert.equal(dayPayload.data.workoutLogs.length, 0);
  assert.equal(dayPayload.data.bodyMetrics.length, 0);
});

test("meal/workout template CRUD routes work", async () => {
  const session = await makeSession();

  const createdMealTemplate = await createMealTemplate(
    new Request("http://localhost/api/v1/templates/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        label: "닭가슴살 도시락",
        mealSlot: "lunch",
        isActive: true
      })
    })
  );
  assert.equal(createdMealTemplate.status, 201);
  const mealTemplate = (await createdMealTemplate.json()) as { data: { id: string } };

  const patchedMealTemplate = await patchMealTemplate(
    new Request(`http://localhost/api/v1/templates/meals/${mealTemplate.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        label: "닭가슴살 샐러드",
        isActive: true
      })
    }),
    { params: Promise.resolve({ id: mealTemplate.data.id }) }
  );
  assert.equal(patchedMealTemplate.status, 200);

  const createdWorkoutTemplate = await createWorkoutTemplate(
    new Request("http://localhost/api/v1/templates/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        label: "푸시 데이",
        bodyPart: "chest",
        purpose: "muscle_gain",
        tool: "barbell",
        defaultDuration: 45,
        isActive: true
      })
    })
  );
  assert.equal(createdWorkoutTemplate.status, 201);
  const workoutTemplate = (await createdWorkoutTemplate.json()) as { data: { id: string } };

  const patchedWorkoutTemplate = await patchWorkoutTemplate(
    new Request(`http://localhost/api/v1/templates/workouts/${workoutTemplate.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        label: "푸시 루틴",
        isActive: true
      })
    }),
    { params: Promise.resolve({ id: workoutTemplate.data.id }) }
  );
  assert.equal(patchedWorkoutTemplate.status, 200);

  const listedMealTemplates = await getMealTemplates(
    new Request(`http://localhost/api/v1/templates/meals?sessionId=${encodeURIComponent(session.sessionId)}`)
  );
  const listedMealPayload = (await listedMealTemplates.json()) as {
    data: { templates: Array<{ id: string }> };
  };
  assert.equal(listedMealPayload.data.templates.length, 1);

  const listedWorkoutTemplates = await getWorkoutTemplates(
    new Request(`http://localhost/api/v1/templates/workouts?sessionId=${encodeURIComponent(session.sessionId)}`)
  );
  const listedWorkoutPayload = (await listedWorkoutTemplates.json()) as {
    data: { templates: Array<{ id: string }> };
  };
  assert.equal(listedWorkoutPayload.data.templates.length, 1);

  const deletedMealTemplate = await deleteMealTemplate(
    new Request(`http://localhost/api/v1/templates/meals/${mealTemplate.data.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId })
    }),
    { params: Promise.resolve({ id: mealTemplate.data.id }) }
  );
  assert.equal(deletedMealTemplate.status, 200);

  const deletedWorkoutTemplate = await deleteWorkoutTemplate(
    new Request(`http://localhost/api/v1/templates/workouts/${workoutTemplate.data.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId })
    }),
    { params: Promise.resolve({ id: workoutTemplate.data.id }) }
  );
  assert.equal(deletedWorkoutTemplate.status, 200);
});

test("GET/POST /v1/reminders/settings and GET /v1/reminders/evaluate work", async () => {
  const session = await makeSession();
  const breakfastTemplate = await createActiveMealTemplateForSlot(session.sessionId, "breakfast", "아침 체크 템플릿");

  const saveResponse = await saveReminderSettings(
    new Request("http://localhost/api/v1/reminders/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        isEnabled: true,
        dailyReminderTime: "20:00",
        missingLogReminderTime: "21:30",
        channels: ["web_in_app", "mobile_local"],
        timezone: "Asia/Seoul"
      })
    })
  );
  assert.equal(saveResponse.status, 201);

  const settingsResponse = await getReminderSettings(
    new Request(`http://localhost/api/v1/reminders/settings?sessionId=${encodeURIComponent(session.sessionId)}`)
  );
  assert.equal(settingsResponse.status, 200);
  const settingsPayload = (await settingsResponse.json()) as {
    data: { settings: { isEnabled: boolean; channels: string[] } | null };
  };
  assert.equal(settingsPayload.data.settings?.isEnabled, true);
  assert.deepEqual(settingsPayload.data.settings?.channels, ["web_in_app", "mobile_local"]);

  const missingResponse = await evaluateReminder(
    new Request(
      `http://localhost/api/v1/reminders/evaluate?sessionId=${encodeURIComponent(session.sessionId)}&date=2026-03-01`
    )
  );
  assert.equal(missingResponse.status, 200);
  const missingPayload = (await missingResponse.json()) as {
    data: { isMissingLogCandidate: boolean };
  };
  assert.equal(missingPayload.data.isMissingLogCandidate, true);

  await createMealCheckin(
    new Request("http://localhost/api/v1/meal-checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: "2026-03-01",
        slot: "breakfast",
        completed: true,
        templateId: breakfastTemplate.id
      })
    })
  );

  const afterMealResponse = await evaluateReminder(
    new Request(
      `http://localhost/api/v1/reminders/evaluate?sessionId=${encodeURIComponent(session.sessionId)}&date=2026-03-01`
    )
  );
  assert.equal(afterMealResponse.status, 200);
  const afterMealPayload = (await afterMealResponse.json()) as {
    data: { isMissingLogCandidate: boolean; mealCount: number };
  };
  assert.equal(afterMealPayload.data.isMissingLogCandidate, false);
  assert.equal(afterMealPayload.data.mealCount, 1);
});

test("GET /v1/bootstrap returns view-scoped payload and supports missing session", async () => {
  const noSessionResponse = await getBootstrap(new Request("http://localhost/api/v1/bootstrap?view=dashboard&range=7d"));
  assert.equal(noSessionResponse.status, 200);
  const noSessionPayload = (await noSessionResponse.json()) as { data: { session: null } };
  assert.equal(noSessionPayload.data.session, null);

  const session = await makeSession();

  const goalResponse = await upsertGoal(
    new Request("http://localhost/api/v1/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        weeklyRoutineTarget: 4
      })
    })
  );
  assert.equal(goalResponse.status, 201);

  const mealTemplateResponse = await createMealTemplate(
    new Request("http://localhost/api/v1/templates/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        label: "아침 샐러드",
        mealSlot: "breakfast",
        isActive: true
      })
    })
  );
  assert.equal(mealTemplateResponse.status, 201);

  const recordsResponse = await getBootstrap(
    new Request(
      `http://localhost/api/v1/bootstrap?sessionId=${encodeURIComponent(session.sessionId)}&view=records&date=2026-03-01&range=7d`
    )
  );
  assert.equal(recordsResponse.status, 200);
  const recordsPayload = (await recordsResponse.json()) as {
    data: {
      session: { sessionId: string } | null;
      dashboard?: { range: string };
      day?: { date: string };
      goal?: { weeklyRoutineTarget: number };
      mealTemplates?: Array<{ id: string }>;
      workoutTemplates?: Array<{ id: string }>;
      fetchedAt: string;
    };
  };

  assert.equal(recordsPayload.data.session?.sessionId, session.sessionId);
  assert.equal(recordsPayload.data.dashboard?.range, "7d");
  assert.equal(recordsPayload.data.day?.date, "2026-03-01");
  assert.equal(recordsPayload.data.goal?.weeklyRoutineTarget, 4);
  assert.equal(Array.isArray(recordsPayload.data.mealTemplates), true);
  assert.equal(Array.isArray(recordsPayload.data.workoutTemplates), true);
  assert.equal(typeof recordsPayload.data.fetchedAt, "string");

  const settingsResponse = await getBootstrap(
    new Request(
      `http://localhost/api/v1/bootstrap?sessionId=${encodeURIComponent(session.sessionId)}&view=settings&date=2026-03-01&range=7d`
    )
  );
  assert.equal(settingsResponse.status, 200);
  const settingsPayload = (await settingsResponse.json()) as {
    data: {
      reminderSettings?: unknown;
    };
  };
  assert.equal("reminderSettings" in settingsPayload.data, true);
});
