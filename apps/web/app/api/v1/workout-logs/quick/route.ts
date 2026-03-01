import { quickWorkoutLogInputSchema, quickWorkoutLogUpdateSchema } from "@routinemate/api-contract";
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
      templateId: parsedBody.templateId,
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
      ...(parsed.data.templateId !== undefined ? { templateId: parsed.data.templateId } : {}),
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

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = resolveSessionId(
      request,
      typeof body.sessionId === "string" ? body.sessionId : null
    ) ?? "";
    const parsed = quickWorkoutLogUpdateSchema.safeParse({
      sessionId,
      id: body.id,
      date: body.date,
      bodyPart: body.bodyPart,
      purpose: body.purpose,
      tool: body.tool,
      exerciseName: body.exerciseName,
      templateId: body.templateId,
      sets: body.sets,
      reps: body.reps,
      weightKg: body.weightKg,
      durationMinutes: body.durationMinutes,
      intensity: body.intensity
    });

    if (!parsed.success) {
      return badRequest("Invalid workout update payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const updated = await repo.updateWorkoutLog(session.userId, parsed.data.id, {
      ...(parsed.data.date !== undefined ? { date: parsed.data.date } : {}),
      ...(parsed.data.bodyPart !== undefined ? { bodyPart: parsed.data.bodyPart } : {}),
      ...(parsed.data.purpose !== undefined ? { purpose: parsed.data.purpose } : {}),
      ...(parsed.data.tool !== undefined ? { tool: parsed.data.tool } : {}),
      ...(parsed.data.exerciseName !== undefined ? { exerciseName: parsed.data.exerciseName } : {}),
      ...(parsed.data.templateId !== undefined ? { templateId: parsed.data.templateId } : {}),
      ...(parsed.data.sets !== undefined ? { sets: parsed.data.sets } : {}),
      ...(parsed.data.reps !== undefined ? { reps: parsed.data.reps } : {}),
      ...(parsed.data.weightKg !== undefined ? { weightKg: parsed.data.weightKg } : {}),
      ...(parsed.data.durationMinutes !== undefined ? { durationMinutes: parsed.data.durationMinutes } : {}),
      ...(parsed.data.intensity !== undefined ? { intensity: parsed.data.intensity } : {})
    });

    if (!updated) {
      return notFound("Workout log was not found.");
    }

    return ok(updated, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update workout log.";
    return internalError(message);
  }
}
