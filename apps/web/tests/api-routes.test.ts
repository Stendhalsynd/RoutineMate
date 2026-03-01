import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { POST as createGuest } from "../app/api/v1/auth/guest/route";
import { POST as createBodyMetric, PATCH as updateBodyMetric } from "../app/api/v1/body-metrics/route";
import { GET as getCalendarDay } from "../app/api/v1/calendar/day/route";
import { GET as getDashboard } from "../app/api/v1/dashboard/route";
import { POST as createMeal, PATCH as updateMeal } from "../app/api/v1/meal-logs/quick/route";
import { POST as createWorkout, PATCH as updateWorkout } from "../app/api/v1/workout-logs/quick/route";
import { repo } from "../src/lib/repository";

type SessionResponse = { data: { sessionId: string; userId: string } };

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
});

test("GET /v1/dashboard without sessionId returns 400", async () => {
  const response = await getDashboard(new Request("http://localhost/api/v1/dashboard"));
  assert.equal(response.status, 400);
});

test("GET /v1/dashboard with unknown session returns 404", async () => {
  const response = await getDashboard(new Request("http://localhost/api/v1/dashboard?sessionId=missing&range=7d"));
  assert.equal(response.status, 404);
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
