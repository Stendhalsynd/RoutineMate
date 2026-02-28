import { authGuestRequestSchema } from "@routinemate/api-contract";
import { badRequest, internalError, ok, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsed = authGuestRequestSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Invalid guest auth payload.", zodIssues(parsed.error));
    }

    const session = repo.createGuestSession(parsed.data.deviceId);
    return ok(session, 201);
  } catch {
    return internalError("Failed to create guest session.");
  }
}
