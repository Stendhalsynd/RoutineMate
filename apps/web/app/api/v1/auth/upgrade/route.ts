import { authUpgradeRequestSchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsedBody = body as { sessionId?: string; email?: string };
    const sessionId = resolveSessionId(request, parsedBody.sessionId ?? null) ?? "";
    const parsed = authUpgradeRequestSchema.safeParse({
      sessionId,
      email: parsedBody.email ?? ""
    });

    if (!parsed.success) {
      return badRequest("Invalid upgrade request.", zodIssues(parsed.error));
    }

    const upgraded = await repo.upgradeSession(parsed.data.sessionId, parsed.data.email);
    if (!upgraded) {
      return notFound("Session was not found.");
    }

    return ok(upgraded, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upgrade account.";
    return internalError(message);
  }
}
