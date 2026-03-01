import assert from "node:assert/strict";
import test from "node:test";
import { buildCalendarUiCells } from "../src/lib/calendar-summary";
import type { DailyProgress } from "@routinemate/domain";

test("buildCalendarUiCells maps daily progress to color and badges", () => {
  const daily: DailyProgress[] = [
    {
      date: "2026-03-01",
      mealLogCount: 2,
      workoutLogCount: 1,
      hasBodyMetric: true,
      dietScore: 66,
      workoutScore: 100,
      consistencyScore: 100,
      overallScore: 83,
      status: "on_track"
    },
    {
      date: "2026-03-02",
      mealLogCount: 0,
      workoutLogCount: 0,
      hasBodyMetric: false,
      dietScore: 0,
      workoutScore: 0,
      consistencyScore: 0,
      overallScore: 0,
      status: "off_track"
    }
  ];

  const cells = buildCalendarUiCells(daily);
  assert.equal(cells.length, 2);
  const first = cells[0];
  const second = cells[1];
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.color, "green");
  assert.deepEqual(first.badges, ["M", "W", "B"]);
  assert.equal(first.dayLabel, "03/01");
  assert.equal(second.color, "red");
  assert.deepEqual(second.badges, []);
});
