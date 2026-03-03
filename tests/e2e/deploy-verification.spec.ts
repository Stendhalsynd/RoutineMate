import { expect, test } from "@playwright/test";

test("production pages hide internal debug UI and expose core navigation controls", async ({ page }) => {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("빠른 API 확인")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "게스트 세션 시작" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "세션 확인" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "목표 설정" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "리마인더 설정" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Google (로그인|재로그인)/ }).first()).toBeVisible();
  await expect(page.getByText("Notion integration is not configured")).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "식단 템플릿" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "운동 템플릿" })).toBeVisible();

  await page.goto("/records", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "게스트 세션 시작" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "세션 확인" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "식단 체크인" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "운동 체크인" })).toBeVisible();

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "게스트 세션 시작" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "세션 확인" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Day" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Week" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Month" })).toBeVisible();

  await expect(page.getByText("Notion integration is not configured")).toHaveCount(0);
});
