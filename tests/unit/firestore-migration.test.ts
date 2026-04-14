import assert from "node:assert/strict";
import test from "node:test";

import {
  FIRESTORE_USER_SUBCOLLECTIONS,
  userDocPath,
  userSubcollectionPath,
  userSubdocumentPath
} from "../../apps/web/src/lib/firestore-schema";
import {
  buildFirestoreMigrationPlan,
  createMigrationParityReport,
  type NotionMigrationSource
} from "../../apps/web/src/lib/firestore-migration";

test("S7-2 schema exposes canonical user-scoped collections", () => {
  assert.deepEqual(FIRESTORE_USER_SUBCOLLECTIONS, [
    "mealLogs",
    "mealCheckins",
    "workoutLogs",
    "bodyMetrics",
    "goals",
    "mealTemplates",
    "workoutTemplates",
    "reminderSettings"
  ]);
  assert.equal(userDocPath("user_1"), "users/user_1");
  assert.equal(userSubcollectionPath("user_1", "mealCheckins"), "users/user_1/mealCheckins");
  assert.equal(userSubdocumentPath("user_1", "bodyMetrics", "metric_1"), "users/user_1/bodyMetrics/metric_1");
});

test("S7-2 migration plan preserves ids, ownership, and parity counts", () => {
  const source: NotionMigrationSource = {
    sessions: [
      {
        sessionId: "sess_guest",
        userId: "user_1",
        isGuest: true,
        createdAt: "2026-03-01T08:00:00.000Z",
        authProvider: "guest"
      },
      {
        sessionId: "sess_google",
        userId: "user_1",
        isGuest: false,
        email: "jihun@example.com",
        createdAt: "2026-03-10T08:00:00.000Z",
        upgradedAt: "2026-03-10T08:00:00.000Z",
        authProvider: "google",
        providerSubject: "google-sub-1",
        avatarUrl: "https://example.com/avatar.png"
      }
    ],
    mealLogs: [
      {
        id: "meal_1",
        userId: "user_1",
        date: "2026-04-10",
        mealType: "breakfast",
        foodLabel: "Greek yogurt bowl",
        portionSize: "medium",
        createdAt: "2026-04-10",
        isDeleted: false
      }
    ],
    mealCheckins: [
      {
        id: "mchk_1",
        userId: "user_1",
        date: "2026-04-10",
        slot: "dinner2",
        completed: true,
        templateId: "meal_tpl_1",
        createdAt: "2026-04-10",
        isDeleted: true,
        deletedAt: "2026-04-11"
      }
    ],
    workoutLogs: [
      {
        id: "workout_1",
        userId: "user_1",
        date: "2026-04-10",
        bodyPart: "back",
        purpose: "muscle_gain",
        tool: "machine",
        exerciseName: "Lat Pulldown",
        workoutSlot: "pm",
        completed: true,
        durationMinutes: 40,
        intensity: "medium",
        templateId: "work_tpl_1",
        createdAt: "2026-04-10"
      }
    ],
    bodyMetrics: [
      {
        id: "metric_1",
        userId: "user_1",
        date: "2026-04-10",
        weightKg: 72.4,
        bodyFatPct: 18.1,
        createdAt: "2026-04-10"
      }
    ],
    goals: [
      {
        id: "goal_1",
        userId: "user_1",
        dDay: "2026-07-01",
        targetWeightKg: 68,
        targetBodyFat: 14,
        weeklyRoutineTarget: 5,
        createdAt: "2026-03-01"
      }
    ],
    mealTemplates: [
      {
        id: "meal_tpl_1",
        userId: "user_1",
        label: "야식 체크",
        mealSlot: "dinner2",
        isActive: true,
        createdAt: "2026-03-05"
      }
    ],
    workoutTemplates: [
      {
        id: "work_tpl_1",
        userId: "user_1",
        label: "등 루틴",
        bodyPart: "back",
        purpose: "muscle_gain",
        tool: "machine",
        defaultDuration: 45,
        isActive: true,
        createdAt: "2026-03-06"
      }
    ],
    reminderSettings: [
      {
        id: "reminder_1",
        userId: "user_1",
        isEnabled: true,
        dailyReminderTime: "20:30",
        missingLogReminderTime: "21:30",
        channels: ["web_in_app", "mobile_local"],
        timezone: "Asia/Seoul",
        createdAt: "2026-03-07T09:00:00.000Z",
        updatedAt: "2026-04-10T09:00:00.000Z"
      }
    ]
  };

  const plan = buildFirestoreMigrationPlan(source, {
    migratedAt: "2026-04-14T12:00:00.000Z"
  });

  assert.equal(plan.users.length, 1);
  assert.equal(plan.writeCount, 9);

  const userPlan = plan.users[0];
  assert.equal(userPlan.user.path, "users/user_1");
  assert.equal(userPlan.user.data.primarySessionId, "sess_google");
  assert.deepEqual(userPlan.user.data.sessionIds, ["sess_guest", "sess_google"]);
  assert.equal(userPlan.user.data.authProvider, "google");
  assert.equal(userPlan.user.data.email, "jihun@example.com");

  const mealLogWrite = userPlan.writes.find((write) => write.path === "users/user_1/mealLogs/meal_1");
  assert.ok(mealLogWrite);
  assert.equal(mealLogWrite.data.foodLabel, "Greek yogurt bowl");

  const mealCheckinWrite = userPlan.writes.find((write) => write.path === "users/user_1/mealCheckins/mchk_1");
  assert.ok(mealCheckinWrite);
  assert.equal(mealCheckinWrite.data.isDeleted, true);
  assert.equal(mealCheckinWrite.data.deletedAt, "2026-04-11");

  const reminderWrite = userPlan.writes.find(
    (write) => write.path === "users/user_1/reminderSettings/reminder_1"
  );
  assert.ok(reminderWrite);
  assert.equal(reminderWrite.data.timezone, "Asia/Seoul");

  const report = createMigrationParityReport(source, plan);
  assert.deepEqual(report.totals, {
    sessions: { source: 2, target: 2 },
    mealLogs: { source: 1, target: 1 },
    mealCheckins: { source: 1, target: 1 },
    workoutLogs: { source: 1, target: 1 },
    bodyMetrics: { source: 1, target: 1 },
    goals: { source: 1, target: 1 },
    mealTemplates: { source: 1, target: 1 },
    workoutTemplates: { source: 1, target: 1 },
    reminderSettings: { source: 1, target: 1 }
  });
});
