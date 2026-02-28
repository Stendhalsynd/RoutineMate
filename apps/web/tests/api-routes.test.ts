import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { POST as createGuest } from "../app/api/v1/auth/guest/route";
import { GET as getDashboard } from "../app/api/v1/dashboard/route";
import { POST as createMeal } from "../app/api/v1/meal-logs/quick/route";
import { repo } from "../src/lib/repository";

beforeEach(() => {
  repo.clear();
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
  const sessionResponse = await createGuest(
    new Request("http://localhost/api/v1/auth/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })
  );
  const sessionPayload = (await sessionResponse.json()) as { data: { sessionId: string } };

  const response = await createMeal(
    new Request("http://localhost/api/v1/meal-logs/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionPayload.data.sessionId,
        date: "2026-02-31",
        mealType: "lunch",
        foodLabel: "Bibimbap",
        portionSize: "medium"
      })
    })
  );

  assert.equal(response.status, 400);
});
