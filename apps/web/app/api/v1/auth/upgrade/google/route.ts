import { googleUpgradeRequestSchema } from "@routinemate/api-contract";
import { badRequest, internalError, notFound, ok, zodIssues } from "@/lib/api-utils";
import { verifyGoogleIdToken } from "@/lib/google-auth";
import { repo } from "@/lib/repository";
import { resolveSessionId, setSessionCookie } from "@/lib/session-cookie";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = resolveSessionId(request, typeof body.sessionId === "string" ? body.sessionId : null) ?? "";
    const parsed = googleUpgradeRequestSchema.safeParse({
      sessionId,
      idToken: body.idToken,
      platform: body.platform
    });

    if (!parsed.success) {
      return badRequest("Invalid google upgrade request.", zodIssues(parsed.error));
    }

    const profile = await verifyGoogleIdToken(parsed.data.idToken, parsed.data.platform);
    const upgraded = await repo.upgradeSessionWithGoogle(parsed.data.sessionId, profile);
    if (!upgraded) {
      return notFound("Session was not found.");
    }

    const response = ok(upgraded, 200);
    setSessionCookie(response, upgraded.sessionId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upgrade session with Google.";
    return internalError(message);
  }
}
