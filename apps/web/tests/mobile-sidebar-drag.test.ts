import assert from "node:assert/strict";
import test from "node:test";

import { clampSidebarOffset, decideSidebarState } from "../src/lib/mobile-sidebar-drag";

test("clampSidebarOffset keeps offset inside [-width, 0]", () => {
  assert.equal(clampSidebarOffset(-400, 280), -280);
  assert.equal(clampSidebarOffset(-120, 280), -120);
  assert.equal(clampSidebarOffset(40, 280), 0);
});

test("decideSidebarState opens when dragged enough or fast to the right", () => {
  assert.equal(decideSidebarState(-90, 0.1, 280), "open");
  assert.equal(decideSidebarState(-200, 0.9, 280), "open");
});

test("decideSidebarState closes when dragged enough or fast to the left", () => {
  assert.equal(decideSidebarState(-200, 0.1, 280), "closed");
  assert.equal(decideSidebarState(-40, -1.1, 280), "closed");
});
