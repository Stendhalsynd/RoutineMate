import { authUpgradeRequestSchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsed = authUpgradeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Invalid upgrade request.", zodIssues(parsed.error));
    }

    const upgraded = repo.upgradeSession(parsed.data.sessionId, parsed.data.email);
    if (!upgraded) {
      return notFound("Session was not found.");
    }

    return ok(upgraded, 200);
  } catch {
    return internalError("Failed to upgrade account.");
  }
}
