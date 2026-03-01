import {
  toCalendarCellSummary,
  type CalendarCellSummary,
  type DailyProgress
} from "@routinemate/domain";

export type CalendarUiCell = CalendarCellSummary & {
  dayLabel: string;
  badges: Array<"M" | "W" | "B">;
};

function dayLabel(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(value.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

export function buildCalendarUiCells(daily: DailyProgress[]): CalendarUiCell[] {
  return daily.map((item) => {
    const summary = toCalendarCellSummary(item);
    const badges: Array<"M" | "W" | "B"> = [];
    if (summary.hasMealLog) {
      badges.push("M");
    }
    if (summary.hasWorkoutLog) {
      badges.push("W");
    }
    if (summary.hasBodyMetric) {
      badges.push("B");
    }
    return {
      ...summary,
      dayLabel: dayLabel(summary.date),
      badges
    };
  });
}

