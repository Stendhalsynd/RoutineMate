import { bodyMetricInputSchema } from "@routinemate/api-contract";
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
    const parsed = bodyMetricInputSchema.safeParse({
      sessionId,
      date: parsedBody.date,
      weightKg: parsedBody.weightKg,
      bodyFatPct: parsedBody.bodyFatPct
    });

    if (!parsed.success) {
      return badRequest("Invalid body metric payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const payload = {
      date: parsed.data.date,
      ...(parsed.data.weightKg !== undefined ? { weightKg: parsed.data.weightKg } : {}),
      ...(parsed.data.bodyFatPct !== undefined ? { bodyFatPct: parsed.data.bodyFatPct } : {})
    };

    const saved = await repo.addBodyMetric(session.userId, payload);

    return ok(saved, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create body metric entry.";
    return internalError(message);
  }
}
