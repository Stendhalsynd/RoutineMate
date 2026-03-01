import { mealTemplateUpdateSchema, softDeleteSchema } from "@routinemate/api-contract";
import { badRequest, notFound, ok, internalError, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = resolveSessionId(request, typeof body.sessionId === "string" ? body.sessionId : null) ?? "";
    const parsed = mealTemplateUpdateSchema.safeParse({
      sessionId,
      id,
      label: body.label,
      mealSlot: body.mealSlot,
      isActive: body.isActive
    });

    if (!parsed.success) {
      return badRequest("Invalid meal template update payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const updated = await repo.updateMealTemplate(session.userId, parsed.data.id, {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.mealSlot !== undefined ? { mealSlot: parsed.data.mealSlot } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {})
    });

    if (!updated) {
      return notFound("Meal template was not found.");
    }

    return ok(updated, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update meal template.";
    return internalError(message);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = resolveSessionId(request, typeof body.sessionId === "string" ? body.sessionId : null) ?? "";
    const parsed = softDeleteSchema.safeParse({ sessionId, id });

    if (!parsed.success) {
      return badRequest("Invalid meal template delete payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const deleted = await repo.deleteMealTemplate(session.userId, parsed.data.id);
    if (!deleted) {
      return notFound("Meal template was not found.");
    }

    return ok({ id: parsed.data.id, deleted: true }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete meal template.";
    return internalError(message);
  }
}
