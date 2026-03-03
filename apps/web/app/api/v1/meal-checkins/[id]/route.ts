import { mealCheckinUpdateSchema, softDeleteSchema } from "@routinemate/api-contract";
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
    const parsed = mealCheckinUpdateSchema.safeParse({
      sessionId,
      id,
      date: body.date,
      slot: body.slot,
      completed: body.completed,
      templateId: body.templateId
    });

    if (!parsed.success) {
      return badRequest("Invalid meal checkin update payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const currentRows = await repo.listMealCheckinsByUser(session.userId);
    const current = currentRows.find((item) => item.id === parsed.data.id && item.isDeleted !== true);
    if (!current) {
      return notFound("Meal checkin was not found.");
    }

    const nextSlot = parsed.data.slot ?? current.slot;
    const nextCompleted = parsed.data.completed ?? current.completed;
    const nextTemplateId = nextCompleted
      ? parsed.data.templateId ?? current.templateId
      : undefined;

    const templates = await repo.listMealTemplatesByUser(session.userId);
    const activeTemplates = templates.filter((item) => item.isActive);
    const selectedTemplate = nextTemplateId ? activeTemplates.find((item) => item.id === nextTemplateId) : undefined;

    if (nextCompleted) {
      if (!nextTemplateId || activeTemplates.length === 0) {
        return badRequest("활성 식단 템플릿이 필요합니다.");
      }
      if (!selectedTemplate) {
        return badRequest("선택한 식단 템플릿이 비활성 상태이거나 존재하지 않습니다.");
      }
    } else if (nextTemplateId && !selectedTemplate) {
      return badRequest("선택한 식단 템플릿이 비활성 상태이거나 존재하지 않습니다.");
    }

    const updates: Partial<Pick<(typeof current), "date" | "slot" | "completed" | "templateId">> = {
      ...(parsed.data.date !== undefined ? { date: parsed.data.date } : {}),
      ...(parsed.data.slot !== undefined ? { slot: parsed.data.slot } : {}),
      completed: nextCompleted
    };
    if (nextCompleted && selectedTemplate) {
      updates.templateId = selectedTemplate.id;
    }

    const updated = await repo.updateMealCheckin(session.userId, parsed.data.id, updates);

    if (!updated) {
      return notFound("Meal checkin was not found.");
    }

    return ok(updated, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update meal checkin.";
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
      return badRequest("Invalid meal checkin delete payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const deleted = await repo.softDeleteMealCheckin(session.userId, parsed.data.id);
    if (!deleted) {
      return notFound("Meal checkin was not found.");
    }

    return ok({ id: parsed.data.id, deleted: true }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete meal checkin.";
    return internalError(message);
  }
}
