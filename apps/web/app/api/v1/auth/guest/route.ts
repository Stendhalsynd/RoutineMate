import { authGuestRequestSchema } from "@routinemate/api-contract";
import { badRequest, internalError, ok, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { getSessionIdFromRequest, setSessionCookie } from "@/lib/session-cookie";

export async function GET(request: Request) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      return badRequest("Session cookie is missing.");
    }
    const session = await repo.getSession(sessionId);
    if (!session) {
      return badRequest("Session was not found.");
    }
    return ok(session, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restore guest session.";
    return internalError(message);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsed = authGuestRequestSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Invalid guest auth payload.", zodIssues(parsed.error));
    }

    const session = await repo.createGuestSession(parsed.data.deviceId);
    const response = ok(session, 201);
    setSessionCookie(response, session.sessionId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create guest session.";
    return internalError(message);
  }
}
