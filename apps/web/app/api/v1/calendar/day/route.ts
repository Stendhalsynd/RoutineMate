import { calendarDayQuerySchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";
import { mealSlotToMealType, type MealLog } from "@routinemate/domain";

function sameDay(dateA: string, dateB: string): boolean {
  return dateA.slice(0, 10) === dateB.slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionId = resolveSessionId(request, params.get("sessionId")) ?? "";
    const parsed = calendarDayQuerySchema.safeParse({
      sessionId,
      date: params.get("date") ?? ""
    });

    if (!parsed.success) {
      return badRequest("Invalid calendar query.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const mealLogs = await repo.listMealsByUser(session.userId);
    const mealCheckins = await repo.listMealCheckinsByUser(session.userId);
    const workoutLogs = await repo.listWorkoutsByUser(session.userId);
    const bodyMetrics = await repo.listBodyMetricsByUser(session.userId);

    const dayMealCheckins = mealCheckins.filter((item) => sameDay(item.date, parsed.data.date));
    const mergedMealLogs = new Map<string, MealLog>();
    for (const log of mealLogs.filter((item) => sameDay(item.date, parsed.data.date))) {
      mergedMealLogs.set(log.id, log);
    }
    for (const checkin of dayMealCheckins) {
      if (!checkin.completed || checkin.isDeleted) {
        continue;
      }
      mergedMealLogs.set(checkin.id, {
        id: checkin.id,
        userId: checkin.userId,
        date: checkin.date,
        mealType: mealSlotToMealType(checkin.slot),
        foodLabel: "식단 체크",
        portionSize: "medium",
        ...(checkin.templateId ? { templateId: checkin.templateId } : {}),
        createdAt: checkin.createdAt
      });
    }

    return ok(
      {
        date: parsed.data.date,
        mealLogs: Array.from(mergedMealLogs.values()),
        mealCheckins: dayMealCheckins,
        workoutLogs: workoutLogs.filter((item) => sameDay(item.date, parsed.data.date)),
        bodyMetrics: bodyMetrics.filter((item) => sameDay(item.date, parsed.data.date))
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load calendar day.";
    return internalError(message);
  }
}
