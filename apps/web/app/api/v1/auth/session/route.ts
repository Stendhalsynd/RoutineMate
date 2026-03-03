import { internalError, ok } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { getSessionIdFromRequest } from "@/lib/session-cookie";

export async function GET(request: Request) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      return ok(null, 200);
    }
    const session = await repo.getSession(sessionId);
    return ok(session ?? null, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load session.";
    return internalError(message);
  }
}
