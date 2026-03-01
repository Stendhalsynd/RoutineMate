import { mealCheckinInputSchema, isoDateSchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionId = resolveSessionId(request, params.get("sessionId")) ?? "";
    const date = params.get("date");

    if (!sessionId) {
      return badRequest("Invalid session query.");
    }
    if (date) {
      const parsedDate = isoDateSchema.safeParse(date);
      if (!parsedDate.success) {
        return badRequest("Invalid date query.", zodIssues(parsedDate.error));
      }
    }

    const session = await repo.getSession(sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const rows = await repo.listMealCheckinsByUser(session.userId);
    const checkins = date ? rows.filter((item) => item.date.slice(0, 10) === date) : rows;

    return ok({ checkins }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load meal checkins.";
    return internalError(message);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = resolveSessionId(request, typeof body.sessionId === "string" ? body.sessionId : null) ?? "";

    const parsed = mealCheckinInputSchema.safeParse({
      sessionId,
      date: body.date,
      slot: body.slot,
      completed: body.completed,
      templateId: body.templateId
    });

    if (!parsed.success) {
      return badRequest("Invalid meal checkin payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const saved = await repo.addMealCheckin(session.userId, {
      date: parsed.data.date,
      slot: parsed.data.slot,
      completed: parsed.data.completed,
      ...(parsed.data.templateId ? { templateId: parsed.data.templateId } : {})
    });

    return ok(saved, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create meal checkin.";
    return internalError(message);
  }
}
