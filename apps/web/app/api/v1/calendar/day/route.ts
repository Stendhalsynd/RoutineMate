import { calendarDayQuerySchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

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
    const workoutLogs = await repo.listWorkoutsByUser(session.userId);
    const bodyMetrics = await repo.listBodyMetricsByUser(session.userId);

    return ok(
      {
        date: parsed.data.date,
        mealLogs: mealLogs.filter((item) => sameDay(item.date, parsed.data.date)),
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
