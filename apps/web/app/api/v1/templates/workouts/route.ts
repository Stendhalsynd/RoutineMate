import { workoutTemplateInputSchema, goalQuerySchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionId = resolveSessionId(request, params.get("sessionId")) ?? "";
    const parsed = goalQuerySchema.safeParse({ sessionId });
    if (!parsed.success) {
      return badRequest("Invalid template query.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const templates = await repo.listWorkoutTemplatesByUser(session.userId);
    return ok({ templates }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load workout templates.";
    return internalError(message);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = resolveSessionId(request, typeof body.sessionId === "string" ? body.sessionId : null) ?? "";
    const parsed = workoutTemplateInputSchema.safeParse({
      sessionId,
      label: body.label,
      bodyPart: body.bodyPart,
      purpose: body.purpose,
      tool: body.tool,
      defaultDuration: body.defaultDuration,
      isActive: body.isActive
    });

    if (!parsed.success) {
      return badRequest("Invalid workout template payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const created = await repo.createWorkoutTemplate(session.userId, {
      label: parsed.data.label,
      bodyPart: parsed.data.bodyPart,
      purpose: parsed.data.purpose,
      tool: parsed.data.tool,
      ...(parsed.data.defaultDuration !== undefined ? { defaultDuration: parsed.data.defaultDuration } : {}),
      isActive: parsed.data.isActive
    });

    return ok(created, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create workout template.";
    return internalError(message);
  }
}
