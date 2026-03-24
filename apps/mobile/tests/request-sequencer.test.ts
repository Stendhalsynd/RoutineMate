import assert from "node:assert/strict";
import test from "node:test";

import {
  computeMutationRefreshDelay,
  issueRequestSequence,
  shouldApplyRequestSequence
} from "../src/lib/request-sequencer";

test("issueRequestSequence increments monotonically", () => {
  assert.equal(issueRequestSequence(0), 1);
  assert.equal(issueRequestSequence(1), 2);
  assert.equal(issueRequestSequence(9), 10);
});

test("shouldApplyRequestSequence only allows the latest response token", () => {
  const latest = 4;
  assert.equal(shouldApplyRequestSequence(latest, 3), false);
  assert.equal(shouldApplyRequestSequence(latest, 4), true);
});

test("computeMutationRefreshDelay returns remaining debounce window", () => {
  assert.equal(computeMutationRefreshDelay(1_000, 1_050, 250), 200);
  assert.equal(computeMutationRefreshDelay(1_000, 1_249, 250), 1);
});

test("computeMutationRefreshDelay clamps elapsed mutations to zero delay", () => {
  assert.equal(computeMutationRefreshDelay(1_000, 1_250, 250), 0);
  assert.equal(computeMutationRefreshDelay(1_000, 1_500, 250), 0);
});
