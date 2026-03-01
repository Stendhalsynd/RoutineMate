import { reminderSettingsInputSchema, reminderSettingsQuerySchema } from "@routinemate/api-contract";
import { badRequest, internalError, notFound, ok, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionId = resolveSessionId(request, params.get("sessionId")) ?? "";
    const parsed = reminderSettingsQuerySchema.safeParse({ sessionId });

    if (!parsed.success) {
      return badRequest("Invalid reminder settings query.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const settings = await repo.getReminderSettings(session.userId);
    return ok({ settings }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load reminder settings.";
    return internalError(message);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = resolveSessionId(request, typeof body.sessionId === "string" ? body.sessionId : null) ?? "";

    const parsed = reminderSettingsInputSchema.safeParse({
      sessionId,
      isEnabled: body.isEnabled,
      dailyReminderTime: body.dailyReminderTime,
      missingLogReminderTime: body.missingLogReminderTime,
      channels: body.channels,
      timezone: body.timezone
    });

    if (!parsed.success) {
      return badRequest("Invalid reminder settings payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const saved = await repo.upsertReminderSettings(session.userId, {
      isEnabled: parsed.data.isEnabled,
      dailyReminderTime: parsed.data.dailyReminderTime,
      missingLogReminderTime: parsed.data.missingLogReminderTime,
      channels: parsed.data.channels,
      timezone: parsed.data.timezone
    });

    return ok(saved, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save reminder settings.";
    return internalError(message);
  }
}
