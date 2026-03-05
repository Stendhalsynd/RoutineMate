import assert from "node:assert/strict";
import test from "node:test";

import { isTransientNetworkError, toUserFacingErrorMessage } from "../src/lib/api-error";

test("isTransientNetworkError detects network request failed", () => {
  assert.equal(isTransientNetworkError(new Error("Network request failed")), true);
});

test("toUserFacingErrorMessage maps network failures to localized copy", () => {
  const message = toUserFacingErrorMessage(new Error("Network request failed"), "조회에 실패했습니다.");
  assert.equal(message, "네트워크 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.");
});

test("toUserFacingErrorMessage keeps business error message", () => {
  const message = toUserFacingErrorMessage(new Error("Invalid goal payload."), "조회에 실패했습니다.");
  assert.equal(message, "Invalid goal payload.");
});
