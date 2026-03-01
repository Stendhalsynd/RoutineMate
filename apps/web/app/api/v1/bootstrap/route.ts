import { bootstrapQuerySchema } from "@routinemate/api-contract";
import { rangeToDays, mealSlotToMealType, type MealLog } from "@routinemate/domain";
import { aggregateDashboard } from "@/lib/dashboard";
import { badRequest, internalError, ok, zodIssues } from "@/lib/api-utils";
import { repo } from "@/lib/repository";
import { resolveSessionId } from "@/lib/session-cookie";

function buildRangeWindow(range: "7d" | "30d" | "90d"): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const endMs = Date.parse(`${to}T00:00:00.000Z`);
  const fromMs = endMs - (rangeToDays(range) - 1) * 24 * 60 * 60 * 1000;
  return {
    from: new Date(fromMs).toISOString().slice(0, 10),
    to
  };
}

function mealCheckinToMealLog(
  checkin: Awaited<ReturnType<typeof repo.listMealCheckinsByUserInRange>>[number]
): MealLog | null {
  if (!checkin.completed || checkin.isDeleted) {
    return null;
  }
  return {
    id: checkin.id,
    userId: checkin.userId,
    date: checkin.date,
    mealType: mealSlotToMealType(checkin.slot),
    foodLabel: "식단 체크",
    portionSize: "medium",
    ...(checkin.templateId ? { templateId: checkin.templateId } : {}),
    createdAt: checkin.createdAt
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionId = resolveSessionId(request, params.get("sessionId")) ?? undefined;
    const parsed = bootstrapQuerySchema.safeParse({
      sessionId,
      view: params.get("view") ?? undefined,
      date: params.get("date") ?? undefined,
      range: params.get("range") ?? undefined
    });

    if (!parsed.success) {
      return badRequest("Invalid bootstrap query.", zodIssues(parsed.error));
    }

    const fetchedAt = new Date().toISOString();
    if (!parsed.data.sessionId) {
      return ok({ session: null, fetchedAt }, 200);
    }

    const session = await repo.getSession(parsed.data.sessionId);
    if (!session) {
      return ok({ session: null, fetchedAt }, 200);
    }

    const payload: {
      session: typeof session | null;
      fetchedAt: string;
      dashboard?: ReturnType<typeof aggregateDashboard>;
      day?: {
        date: string;
        mealCheckins: Awaited<ReturnType<typeof repo.listMealCheckinsByUserInRange>>;
        workoutLogs: Awaited<ReturnType<typeof repo.listWorkoutsByUserInRange>>;
        bodyMetrics: Awaited<ReturnType<typeof repo.listBodyMetricsByUserInRange>>;
      };
      goal?: Awaited<ReturnType<typeof repo.listGoalsByUser>>[number] | null;
      mealTemplates?: Awaited<ReturnType<typeof repo.listMealTemplatesByUser>>;
      workoutTemplates?: Awaited<ReturnType<typeof repo.listWorkoutTemplatesByUser>>;
      reminderSettings?: Awaited<ReturnType<typeof repo.getReminderSettings>> | null;
    } = {
      session,
      fetchedAt
    };

    if (parsed.data.view === "dashboard" || parsed.data.view === "records") {
      const window = buildRangeWindow(parsed.data.range);
      const [mealLogs, checkins, workouts, bodyMetrics, goals] = await Promise.all([
        repo.listMealsByUserInRange(session.userId, window.from, window.to),
        repo.listMealCheckinsByUserInRange(session.userId, window.from, window.to),
        repo.listWorkoutsByUserInRange(session.userId, window.from, window.to),
        repo.listBodyMetricsByUserInRange(session.userId, window.from, window.to),
        repo.listGoalsByUser(session.userId)
      ]);

      const mergedMeals = new Map<string, MealLog>();
      for (const item of mealLogs) {
        mergedMeals.set(item.id, item);
      }
      for (const checkin of checkins) {
        const mapped = mealCheckinToMealLog(checkin);
        if (mapped) {
          mergedMeals.set(mapped.id, mapped);
        }
      }

      payload.dashboard = aggregateDashboard({
        range: parsed.data.range,
        meals: Array.from(mergedMeals.values()),
        workouts,
        bodyMetrics,
        goals
      });
    }

    if (parsed.data.view === "records") {
      const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);
      const [mealCheckins, workoutLogs, bodyMetrics] = await Promise.all([
        repo.listMealCheckinsByUserInRange(session.userId, date, date),
        repo.listWorkoutsByUserInRange(session.userId, date, date),
        repo.listBodyMetricsByUserInRange(session.userId, date, date)
      ]);
      payload.day = {
        date,
        mealCheckins,
        workoutLogs,
        bodyMetrics
      };
      const [mealTemplates, workoutTemplates, reminderSettings] = await Promise.all([
        repo.listMealTemplatesByUser(session.userId),
        repo.listWorkoutTemplatesByUser(session.userId),
        repo.getReminderSettings(session.userId)
      ]);
      payload.mealTemplates = mealTemplates;
      payload.workoutTemplates = workoutTemplates;
      payload.reminderSettings = reminderSettings;
    }

    if (parsed.data.view === "settings") {
      const [goals, mealTemplates, workoutTemplates, reminderSettings] = await Promise.all([
        repo.listGoalsByUser(session.userId),
        repo.listMealTemplatesByUser(session.userId),
        repo.listWorkoutTemplatesByUser(session.userId),
        repo.getReminderSettings(session.userId)
      ]);
      payload.goal = goals[0] ?? null;
      payload.mealTemplates = mealTemplates;
      payload.workoutTemplates = workoutTemplates;
      payload.reminderSettings = reminderSettings;
    }

    if (parsed.data.view === "dashboard") {
      const goals = await repo.listGoalsByUser(session.userId);
      payload.goal = goals[0] ?? null;
    }

    return ok(payload, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load bootstrap payload.";
    return internalError(message);
  }
}
