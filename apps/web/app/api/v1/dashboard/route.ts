import { dashboardQuerySchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { aggregateDashboard } from "@/lib/dashboard";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";
import { mealSlotToMealType, rangeToDays, type MealLog } from "@routinemate/domain";

const DASHBOARD_CACHE_TTL_MS = 60_000;
const dashboardCache = new Map<
  string,
  {
    expiresAt: number;
    summary: ReturnType<typeof aggregateDashboard>;
  }
>();

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

function buildRangeWindow(range: "7d" | "30d" | "90d"): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const endMs = Date.parse(`${to}T00:00:00.000Z`);
  const fromMs = endMs - (rangeToDays(range) - 1) * 24 * 60 * 60 * 1000;
  return {
    from: new Date(fromMs).toISOString().slice(0, 10),
    to
  };
}

export async function GET(request: Request) {
  try {
    const startedAt = Date.now();
    const params = new URL(request.url).searchParams;
    const sessionId = resolveSessionId(request, params.get("sessionId")) ?? "";
    const parsed = dashboardQuerySchema.safeParse({
      sessionId,
      range: params.get("range") ?? undefined,
      fresh: params.get("fresh") ?? undefined
    });

    if (!parsed.success) {
      return badRequest("Invalid dashboard query.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const window = buildRangeWindow(parsed.data.range);
    const cacheKey = `${session.userId}:${parsed.data.range}:${window.to}`;
    const forceFresh = parsed.data.fresh === "1" || parsed.data.fresh === "true";
    const cached = dashboardCache.get(cacheKey);
    if (!forceFresh && cached && cached.expiresAt > Date.now()) {
      console.info(
        `[dashboard] cache-hit range=${parsed.data.range} fresh=${forceFresh} elapsedMs=${Date.now() - startedAt}`
      );
      return ok(cached.summary, 200);
    }

    const mealLogs = await repo.listMealsByUserInRange(session.userId, window.from, window.to);
    const checkins = await repo.listMealCheckinsByUserInRange(session.userId, window.from, window.to);
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
      workouts: await repo.listWorkoutsByUserInRange(session.userId, window.from, window.to),
      bodyMetrics: await repo.listBodyMetricsByUserInRange(session.userId, window.from, window.to),
      goals: await repo.listGoalsByUser(session.userId)
    });

    dashboardCache.set(cacheKey, {
      summary,
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS
    });
    console.info(
      `[dashboard] cache-${forceFresh ? "bypass" : "miss"} range=${parsed.data.range} fresh=${forceFresh} elapsedMs=${Date.now() - startedAt}`
    );

    return ok(summary, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard summary.";
    return internalError(message);
  }
}
