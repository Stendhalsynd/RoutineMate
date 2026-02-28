import { calendarDayQuerySchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";

function sameDay(dateA: string, dateB: string): boolean {
  return dateA.slice(0, 10) === dateB.slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const parsed = calendarDayQuerySchema.safeParse({
      sessionId: params.get("sessionId") ?? "",
      date: params.get("date") ?? ""
    });

    if (!parsed.success) {
      return badRequest("Invalid calendar query.", zodIssues(parsed.error));
    }

    const session = repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    return ok(
      {
        date: parsed.data.date,
        mealLogs: repo.listMealsByUser(session.userId).filter((item) => sameDay(item.date, parsed.data.date)),
        workoutLogs: repo.listWorkoutsByUser(session.userId).filter((item) => sameDay(item.date, parsed.data.date)),
        bodyMetrics: repo.listBodyMetricsByUser(session.userId).filter((item) => sameDay(item.date, parsed.data.date))
      },
      200
    );
  } catch {
    return internalError("Failed to load calendar day.");
  }
}
