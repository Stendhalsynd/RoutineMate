import { reminderEvaluateQuerySchema } from "@routinemate/api-contract";
import { badRequest, internalError, notFound, ok, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionId = resolveSessionId(request, params.get("sessionId")) ?? "";
    const parsed = reminderEvaluateQuerySchema.safeParse({
      sessionId,
      date: params.get("date")
    });

    if (!parsed.success) {
      return badRequest("Invalid reminder evaluation query.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const result = await repo.evaluateReminder(session.userId, parsed.data.date);
    return ok(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to evaluate reminder status.";
    return internalError(message);
  }
}
