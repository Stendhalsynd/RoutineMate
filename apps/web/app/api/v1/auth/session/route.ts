import { internalError, ok } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { getSessionIdFromRequest, setSessionCookie } from "@/lib/session-cookie";

export async function GET(request: Request) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      return ok(null, 200);
    }
    const session = await repo.getSession(sessionId);
    if (!session) {
      return ok(null, 200);
    }

    if (session.authProvider === "google") {
      const canonical = await repo.resolveCanonicalGoogleSession(session);
      const response = ok(canonical, 200);
      if (canonical.sessionId !== session.sessionId) {
        setSessionCookie(response, canonical.sessionId);
      }
      return response;
    }

    return ok(session, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load session.";
    return internalError(message);
  }
}
