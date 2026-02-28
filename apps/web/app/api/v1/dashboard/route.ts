import { dashboardQuerySchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { aggregateDashboard } from "@/lib/dashboard";
import { repo } from "@/lib/repository";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const parsed = dashboardQuerySchema.safeParse({
      sessionId: params.get("sessionId") ?? "",
      range: params.get("range") ?? undefined
    });

    if (!parsed.success) {
      return badRequest("Invalid dashboard query.", zodIssues(parsed.error));
    }

    const session = repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const summary = aggregateDashboard({
      range: parsed.data.range,
      meals: repo.listMealsByUser(session.userId),
      workouts: repo.listWorkoutsByUser(session.userId),
      bodyMetrics: repo.listBodyMetricsByUser(session.userId),
      goals: repo.listGoalsByUser(session.userId)
    });

    return ok(summary, 200);
  } catch {
    return internalError("Failed to load dashboard summary.");
  }
}
