import { dashboardQuerySchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { aggregateDashboard } from "@/lib/dashboard";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";
import { mealSlotToMealType, type MealLog } from "@routinemate/domain";

function mealCheckinToMealLog(
  checkin: Awaited<ReturnType<typeof repo.listMealCheckinsByUser>>[number]
): MealLog | null {
  if (!checkin.completed || checkin.isDeleted) {
    return null;
  }
  return {
    id: checkin.id,
    userId: checkin.userId,
    date: checkin.date,
    mealType: mealSlotToMealType(checkin.slot),
    foodLabel: "식단 체크",
    portionSize: "medium",
    ...(checkin.templateId ? { templateId: checkin.templateId } : {}),
    createdAt: checkin.createdAt
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionId = resolveSessionId(request, params.get("sessionId")) ?? "";
    const parsed = dashboardQuerySchema.safeParse({
      sessionId,
      range: params.get("range") ?? undefined
    });

    if (!parsed.success) {
      return badRequest("Invalid dashboard query.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const mealLogs = await repo.listMealsByUser(session.userId);
    const checkins = await repo.listMealCheckinsByUser(session.userId);
    const mergedMeals = new Map<string, MealLog>();
    for (const item of mealLogs) {
      mergedMeals.set(item.id, item);
    }
    for (const checkin of checkins) {
      const mapped = mealCheckinToMealLog(checkin);
      if (mapped) {
        mergedMeals.set(mapped.id, mapped);
      }
    }

    const summary = aggregateDashboard({
      range: parsed.data.range,
      meals: Array.from(mergedMeals.values()),
      workouts: await repo.listWorkoutsByUser(session.userId),
      bodyMetrics: await repo.listBodyMetricsByUser(session.userId),
      goals: await repo.listGoalsByUser(session.userId)
    });

    return ok(summary, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard summary.";
    return internalError(message);
  }
}
