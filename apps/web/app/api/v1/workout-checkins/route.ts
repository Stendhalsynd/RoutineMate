import { workoutCheckinInputSchema } from "@routinemate/api-contract";
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

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = resolveSessionId(request, typeof body.sessionId === "string" ? body.sessionId : null) ?? "";
    const parsed = workoutCheckinInputSchema.safeParse({
      sessionId,
      date: body.date,
      slot: body.slot,
      completed: body.completed,
      templateId: body.templateId
    });

    if (!parsed.success) {
      return badRequest("Invalid workout checkin payload.", zodIssues(parsed.error));
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return notFound("Session was not found.");
    }

    let selectedTemplate: WorkoutTemplate | undefined;
    if (parsed.data.templateId) {
      const templates = await repo.listWorkoutTemplatesByUser(session.userId);
      selectedTemplate = templates.find((item) => item.id === parsed.data.templateId);
      if (!selectedTemplate) {
        return notFound("Workout template was not found.");
      }
    }

    const base = applyTemplateOrDefault(parsed.data.slot, selectedTemplate);
    const saved = await repo.addWorkoutLog(session.userId, {
      date: parsed.data.date,
      bodyPart: base.bodyPart,
      purpose: base.purpose,
      tool: base.tool,
      exerciseName: base.exerciseName,
      durationMinutes: base.durationMinutes,
      intensity: "medium",
      workoutSlot: parsed.data.slot,
      completed: parsed.data.completed,
      ...(parsed.data.templateId ? { templateId: parsed.data.templateId } : {})
    });

    return ok(saved, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create workout checkin.";
    return internalError(message);
  }
}
