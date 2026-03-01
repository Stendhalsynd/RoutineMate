import { expect, test } from "@playwright/test";

function uniqueLabel(prefix: string): string {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

test("production settings page supports goal/template actions and hides internal debug section", async ({
  page,
  request,
  context,
  baseURL
}) => {
  const mealLabel = uniqueLabel("meal-tpl");
  const workoutLabel = uniqueLabel("workout-tpl");

  const guestResponse = await request.post("/api/v1/auth/guest", { data: {} });
  expect(guestResponse.ok()).toBeTruthy();
  const guestPayload = (await guestResponse.json()) as {
    data?: { sessionId?: string };
  };
  const sessionId = guestPayload.data?.sessionId;
  expect(sessionId).toBeTruthy();

  const host = new URL(baseURL ?? "https://routinemate-kohl.vercel.app").hostname;
  await context.addCookies([
    {
      name: "routinemate_session_id",
      value: sessionId!,
      domain: host,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax"
    }
  ]);

  await page.goto("/settings", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("빠른 API 확인")).toHaveCount(0);

  const sessionButton = page.getByRole("button", { name: "세션 확인" });
  await expect(sessionButton).toBeEnabled({ timeout: 20_000 });
  await sessionButton.click();
  await expect(page.getByText(/세션 ID:/)).toBeVisible({ timeout: 20_000 });

  const goalCard = page.locator(".settings-goal-card");
  await goalCard.getByLabel("주간 루틴 목표(회)").fill("4");
  await goalCard.getByLabel("D-day").fill("2026-12-31");
  await goalCard.getByLabel("목표 체중(kg)").fill("70");
  await goalCard.getByLabel("목표 체지방(%)").fill("15");
  await goalCard.getByRole("button", { name: "목표 저장" }).click();

  await expect(page.getByText("목표를 저장했습니다.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Notion integration is not configured")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "리마인더 설정" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google로 계정 전환" })).toBeVisible();

  const mealArticle = page.locator("article", {
    has: page.getByRole("heading", { name: "식단 템플릿" })
  });

  await mealArticle.getByLabel("템플릿명").fill(mealLabel);
  await mealArticle.getByRole("button", { name: "식단 템플릿 추가" }).click();
  await expect(mealArticle.getByText(mealLabel)).toBeVisible({ timeout: 20_000 });

  const workoutArticle = page.locator("article", {
    has: page.getByRole("heading", { name: "운동 템플릿" })
  });

  await workoutArticle.getByLabel("템플릿명").fill(workoutLabel);
  await workoutArticle.getByRole("button", { name: "운동 템플릿 추가" }).click();
  await expect(workoutArticle.getByText(workoutLabel)).toBeVisible({ timeout: 20_000 });

  await page.goto("/records", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "게스트 세션 시작" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "세션 확인" })).toHaveCount(0);

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "게스트 세션 시작" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "세션 확인" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Day" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Week" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Month" })).toBeVisible();

  await expect(page.getByText("Notion integration is not configured")).toHaveCount(0);
});
