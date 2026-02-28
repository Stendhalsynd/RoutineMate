import { dashboardQuerySchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { aggregateDashboard } from "@/lib/dashboard";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

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

    const summary = aggregateDashboard({
      range: parsed.data.range,
      meals: await repo.listMealsByUser(session.userId),
      workouts: await repo.listWorkoutsByUser(session.userId),
      bodyMetrics: await repo.listBodyMetricsByUser(session.userId),
      goals: await repo.listGoalsByUser(session.userId)
    });

    summary.consistencyMeta = {
      source: "notion",
      refreshedAt: new Date().toISOString(),
      range: parsed.data.range
    };

    return ok(summary, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard summary.";
    return internalError(message);
  }
}
