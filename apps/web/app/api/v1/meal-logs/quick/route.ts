import { quickMealLogInputSchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsed = quickMealLogInputSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Invalid meal log payload.", zodIssues(parsed.error));
    }

    const session = repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const saved = repo.addMealLog(session.userId, {
      date: parsed.data.date,
      mealType: parsed.data.mealType,
      foodLabel: parsed.data.foodLabel,
      portionSize: parsed.data.portionSize
    });

    return ok(saved, 201);
  } catch {
    return internalError("Failed to create meal log.");
  }
}
