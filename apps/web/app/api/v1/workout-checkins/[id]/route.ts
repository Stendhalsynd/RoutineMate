import { softDeleteSchema, workoutCheckinUpdateSchema } from "@routinemate/api-contract";
import { badRequest, internalError, notFound, ok, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";
import type { WorkoutSlot, WorkoutTemplate } from "@routinemate/domain";

function slotLabel(slot: WorkoutSlot): string {
  return slot === "am" ? "오전" : "오후";
}

function defaultsBySlot(slot: WorkoutSlot) {
  return {
    bodyPart: "full_body" as const,
    purpose: "fat_loss" as const,
    tool: "bodyweight" as const,
    exerciseName: `운동 ${slotLabel(slot)} 체크`,
    durationMinutes: slot === "am" ? 20 : 30
  };
}

function applyTemplateOrDefault(slot: WorkoutSlot, template?: WorkoutTemplate) {
  if (!template) {
    return defaultsBySlot(slot);
  }
  return {
    bodyPart: template.bodyPart,
    purpose: template.purpose,
    tool: template.tool,
    exerciseName: template.label,
    durationMinutes: template.defaultDuration ?? defaultsBySlot(slot).durationMinutes
  };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = resolveSessionId(request, typeof body.sessionId === "string" ? body.sessionId : null) ?? "";
    const parsed = workoutCheckinUpdateSchema.safeParse({
      sessionId,
      id,
      date: body.date,
      slot: body.slot,
      completed: body.completed,
      templateId: body.templateId
    });

    if (!parsed.success) {
      return badRequest("Invalid workout checkin update payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const all = await repo.listWorkoutsByUser(session.userId);
    const current = all.find((item) => item.id === parsed.data.id && item.isDeleted !== true);
    if (!current) {
      return notFound("Workout checkin was not found.");
    }

    const nextSlot = parsed.data.slot ?? current.workoutSlot ?? "pm";
    const nextDate = parsed.data.date ?? current.date;
    const nextCompleted = parsed.data.completed ?? current.completed ?? true;

    const templates = await repo.listWorkoutTemplatesByUser(session.userId);
    const activeTemplates = templates.filter((item) => item.isActive);
    let selectedTemplate: WorkoutTemplate | undefined;
    const nextTemplateId = nextCompleted ? (parsed.data.templateId ?? current.templateId) : parsed.data.templateId;
    if (nextTemplateId) {
      selectedTemplate = activeTemplates.find((item) => item.id === nextTemplateId);
    }

    if (nextCompleted) {
      if (!nextTemplateId || activeTemplates.length === 0) {
        return badRequest("활성 운동 템플릿이 필요합니다.");
      }
      if (!selectedTemplate) {
        return badRequest("선택한 운동 템플릿이 비활성 상태이거나 존재하지 않습니다.");
      }
    } else if (nextTemplateId && !selectedTemplate) {
      return badRequest("선택한 운동 템플릿이 비활성 상태이거나 존재하지 않습니다.");
    }

    const base = applyTemplateOrDefault(nextSlot, selectedTemplate);
    const nextDurationMinutes = selectedTemplate ? base.durationMinutes : current.durationMinutes;
    const updated = await repo.updateWorkoutLog(session.userId, parsed.data.id, {
      date: nextDate,
      workoutSlot: nextSlot,
      completed: nextCompleted,
      bodyPart: selectedTemplate ? base.bodyPart : current.bodyPart,
      purpose: selectedTemplate ? base.purpose : current.purpose,
      tool: selectedTemplate ? base.tool : current.tool,
      exerciseName: selectedTemplate ? base.exerciseName : current.exerciseName,
      ...(nextDurationMinutes !== undefined ? { durationMinutes: nextDurationMinutes } : {}),
      ...(nextTemplateId !== undefined ? { templateId: nextTemplateId } : {})
    });

    if (!updated) {
      return notFound("Workout checkin was not found.");
    }

    return ok(updated, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update workout checkin.";
    return internalError(message);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = resolveSessionId(request, typeof body.sessionId === "string" ? body.sessionId : null) ?? "";
    const parsed = softDeleteSchema.safeParse({ sessionId, id });

    if (!parsed.success) {
      return badRequest("Invalid workout checkin delete payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    const deleted = await repo.softDeleteWorkoutLog(session.userId, parsed.data.id);
    if (!deleted) {
      return notFound("Workout checkin was not found.");
    }

    return ok({ id: parsed.data.id, deleted: true }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete workout checkin.";
    return internalError(message);
  }
}
