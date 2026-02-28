import { bodyMetricInputSchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsed = bodyMetricInputSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Invalid body metric payload.", zodIssues(parsed.error));
    }

    const session = repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const payload = {
      date: parsed.data.date,
      ...(parsed.data.weightKg !== undefined ? { weightKg: parsed.data.weightKg } : {}),
      ...(parsed.data.bodyFatPct !== undefined ? { bodyFatPct: parsed.data.bodyFatPct } : {})
    };

    const saved = repo.addBodyMetric(session.userId, payload);

    return ok(saved, 201);
  } catch {
    return internalError("Failed to create body metric entry.");
  }
}
