import { goalInputSchema, goalQuerySchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const parsed = goalQuerySchema.safeParse({
      sessionId: params.get("sessionId") ?? ""
    });

    if (!parsed.success) {
      return badRequest("Invalid goal query.", zodIssues(parsed.error));
    }

    const session = repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const goals = [...repo.listGoalsByUser(session.userId)].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
    const reversed = goals.reverse();

    return ok({
      goal: reversed[0] ?? null,
      goals: reversed
    });
  } catch {
    return internalError("Failed to load goals.");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsed = goalInputSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Invalid goal payload.", zodIssues(parsed.error));
    }

    const session = repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const payload = {
      weeklyRoutineTarget: parsed.data.weeklyRoutineTarget,
      ...(parsed.data.dDay !== undefined ? { dDay: parsed.data.dDay } : {}),
      ...(parsed.data.targetWeightKg !== undefined ? { targetWeightKg: parsed.data.targetWeightKg } : {}),
      ...(parsed.data.targetBodyFat !== undefined ? { targetBodyFat: parsed.data.targetBodyFat } : {})
    };

    const saved = repo.upsertGoal(session.userId, payload);

    return ok(saved, 201);
  } catch {
    return internalError("Failed to upsert goal.");
  }
}
