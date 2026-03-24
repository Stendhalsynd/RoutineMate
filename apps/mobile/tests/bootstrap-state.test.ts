import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSessionSnapshotKey,
  resolveBootstrapReminderSettings,
  type ReminderStateLike
} from "../src/lib/bootstrap-state";

const defaults: ReminderStateLike = {
  isEnabled: true,
  dailyReminderTime: "20:00",
  missingLogReminderTime: "21:30",
  channels: ["web_in_app", "mobile_local"],
  timezone: "Asia/Seoul"
};

test("buildSessionSnapshotKey combines userId and sessionId", () => {
  assert.equal(buildSessionSnapshotKey({ userId: "user_1", sessionId: "sess_1" }), "user_1:sess_1");
  assert.equal(buildSessionSnapshotKey(null), null);
});

test("resolveBootstrapReminderSettings keeps undefined as absent field", () => {
  assert.equal(resolveBootstrapReminderSettings(undefined, defaults), undefined);
});

test("resolveBootstrapReminderSettings resets null payload to defaults", () => {
  assert.deepEqual(resolveBootstrapReminderSettings(null, defaults), defaults);
});

test("resolveBootstrapReminderSettings keeps explicit payload values", () => {
  const explicit = {
    ...defaults,
    isEnabled: false,
    dailyReminderTime: "19:00"
  };
  assert.deepEqual(resolveBootstrapReminderSettings(explicit, defaults), explicit);
});
