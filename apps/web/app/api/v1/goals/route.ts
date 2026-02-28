import { goalInputSchema, goalQuerySchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionId = resolveSessionId(request, params.get("sessionId")) ?? "";
    const parsed = goalQuerySchema.safeParse({
      sessionId
    });

    if (!parsed.success) {
      return badRequest("Invalid goal query.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const goals = [...(await repo.listGoalsByUser(session.userId))].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
    const reversed = goals.reverse();

    return ok({
      goal: reversed[0] ?? null,
      goals: reversed
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load goals.";
    return internalError(message);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsedBody = body as Record<string, unknown>;
    const sessionId = resolveSessionId(
      request,
      typeof parsedBody.sessionId === "string" ? parsedBody.sessionId : null
    ) ?? "";
    const parsed = goalInputSchema.safeParse({
      sessionId,
      dDay: parsedBody.dDay,
      targetWeightKg: parsedBody.targetWeightKg,
      targetBodyFat: parsedBody.targetBodyFat,
      weeklyRoutineTarget: parsedBody.weeklyRoutineTarget
    });

    if (!parsed.success) {
      return badRequest("Invalid goal payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const payload = {
      weeklyRoutineTarget: parsed.data.weeklyRoutineTarget,
      ...(parsed.data.dDay !== undefined ? { dDay: parsed.data.dDay } : {}),
      ...(parsed.data.targetWeightKg !== undefined ? { targetWeightKg: parsed.data.targetWeightKg } : {}),
      ...(parsed.data.targetBodyFat !== undefined ? { targetBodyFat: parsed.data.targetBodyFat } : {})
    };

    const saved = await repo.upsertGoal(session.userId, payload);

    return ok(saved, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upsert goal.";
    return internalError(message);
  }
}
