import assert from "node:assert/strict";
import { test } from "node:test";

import { getFirebaseAdminConfig } from "../src/lib/firestore-admin";

test("getFirebaseAdminConfig normalizes quoted FIREBASE_PRIVATE_KEY values", () => {
  const originalProjectId = process.env.FIREBASE_PROJECT_ID;
  const originalPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  process.env.FIREBASE_PROJECT_ID = "test-project";
  process.env.FIREBASE_PRIVATE_KEY =
    '"-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----\\n"';

  try {
    const config = getFirebaseAdminConfig();
    assert.equal(config.privateKey, "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n");
  } finally {
    if (originalProjectId === undefined) {
      delete process.env.FIREBASE_PROJECT_ID;
    } else {
      process.env.FIREBASE_PROJECT_ID = originalProjectId;
    }

    if (originalPrivateKey === undefined) {
      delete process.env.FIREBASE_PRIVATE_KEY;
    } else {
      process.env.FIREBASE_PRIVATE_KEY = originalPrivateKey;
    }
  }
});
