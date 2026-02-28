import { quickWorkoutLogInputSchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsed = quickWorkoutLogInputSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Invalid workout log payload.", zodIssues(parsed.error));
    }

    const session = repo.getSession(parsed.data.sessionId);
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

    const saved = repo.addWorkoutLog(session.userId, payload);

    return ok(saved, 201);
  } catch {
    return internalError("Failed to create workout log.");
  }
}
