import { quickMealLogInputSchema, quickMealLogUpdateSchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsedBody = body as {
      sessionId?: string;
      date?: string;
      mealType?: string;
      foodLabel?: string;
      portionSize?: string;
    };
    const sessionId = resolveSessionId(request, parsedBody.sessionId ?? null) ?? "";
    const parsed = quickMealLogInputSchema.safeParse({
      sessionId,
      date: parsedBody.date ?? "",
      mealType: parsedBody.mealType,
      foodLabel: parsedBody.foodLabel,
      portionSize: parsedBody.portionSize
    });

    if (!parsed.success) {
      return badRequest("Invalid meal log payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const saved = await repo.addMealLog(session.userId, {
      date: parsed.data.date,
      mealType: parsed.data.mealType,
      foodLabel: parsed.data.foodLabel,
      portionSize: parsed.data.portionSize
    });

    return ok(saved, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create meal log.";
    return internalError(message);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = resolveSessionId(request, typeof body.sessionId === "string" ? body.sessionId : null) ?? "";
    const parsed = quickMealLogUpdateSchema.safeParse({
      sessionId,
      id: body.id,
      date: body.date,
      mealType: body.mealType,
      foodLabel: body.foodLabel,
      portionSize: body.portionSize
    });

    if (!parsed.success) {
      return badRequest("Invalid meal update payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const updated = await repo.updateMealLog(session.userId, parsed.data.id, {
      ...(parsed.data.date !== undefined ? { date: parsed.data.date } : {}),
      ...(parsed.data.mealType !== undefined ? { mealType: parsed.data.mealType } : {}),
      ...(parsed.data.foodLabel !== undefined ? { foodLabel: parsed.data.foodLabel } : {}),
      ...(parsed.data.portionSize !== undefined ? { portionSize: parsed.data.portionSize } : {})
    });

    if (!updated) {
      return notFound("Meal log was not found.");
    }

    return ok(updated, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update meal log.";
    return internalError(message);
  }
}
