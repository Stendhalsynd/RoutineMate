import { quickWorkoutLogInputSchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsedBody = body as Record<string, unknown>;
    const sessionId = resolveSessionId(
      request,
      typeof parsedBody.sessionId === "string" ? parsedBody.sessionId : null
    ) ?? "";
    const parsed = quickWorkoutLogInputSchema.safeParse({
      sessionId,
      date: parsedBody.date,
      bodyPart: parsedBody.bodyPart,
      purpose: parsedBody.purpose,
      tool: parsedBody.tool,
      exerciseName: parsedBody.exerciseName,
      sets: parsedBody.sets,
      reps: parsedBody.reps,
      weightKg: parsedBody.weightKg,
      durationMinutes: parsedBody.durationMinutes,
      intensity: parsedBody.intensity
    });

    if (!parsed.success) {
      return badRequest("Invalid workout log payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const payload = {
      date: parsed.data.date,
      bodyPart: parsed.data.bodyPart,
      purpose: parsed.data.purpose,
      tool: parsed.data.tool,
      exerciseName: parsed.data.exerciseName,
      ...(parsed.data.sets !== undefined ? { sets: parsed.data.sets } : {}),
      ...(parsed.data.reps !== undefined ? { reps: parsed.data.reps } : {}),
      ...(parsed.data.weightKg !== undefined ? { weightKg: parsed.data.weightKg } : {}),
      ...(parsed.data.durationMinutes !== undefined ? { durationMinutes: parsed.data.durationMinutes } : {}),
      ...(parsed.data.intensity !== undefined ? { intensity: parsed.data.intensity } : {})
    };

    const saved = await repo.addWorkoutLog(session.userId, payload);

    return ok(saved, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create workout log.";
    return internalError(message);
  }
}
