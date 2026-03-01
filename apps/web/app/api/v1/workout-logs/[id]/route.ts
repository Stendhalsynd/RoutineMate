import { softDeleteSchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = resolveSessionId(request, typeof body.sessionId === "string" ? body.sessionId : null) ?? "";
    const parsed = softDeleteSchema.safeParse({ sessionId, id });

    if (!parsed.success) {
      return badRequest("Invalid workout delete payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const deleted = await repo.softDeleteWorkoutLog(session.userId, parsed.data.id);
    if (!deleted) {
      return notFound("Workout log was not found.");
    }

    return ok({ id: parsed.data.id, deleted: true }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete workout log.";
    return internalError(message);
  }
}
