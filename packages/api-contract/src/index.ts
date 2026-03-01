import { z } from "zod";

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Expected YYYY-MM-DD")
  .refine((value) => isValidIsoDate(value), "Invalid calendar date");
const nonEmptyString = z.string().trim().min(1);
const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/u, "Expected HH:MM");

export const rangeSchema = z.enum(["7d", "30d", "90d"]);

export const authGuestRequestSchema = z.object({
  deviceId: nonEmptyString.optional()
});

export const authUpgradeRequestSchema = z.object({
  sessionId: nonEmptyString,
  email: z.string().email()
});

export const googleUpgradeRequestSchema = z.object({
  sessionId: nonEmptyString,
  idToken: nonEmptyString,
  platform: z.enum(["web", "android"])
});

export const googleSessionRequestSchema = z.object({
  idToken: nonEmptyString,
  platform: z.enum(["web", "android"])
});

export const quickMealLogInputSchema = z.object({
  sessionId: nonEmptyString,
  date: isoDateSchema,
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  foodLabel: nonEmptyString.max(120),
  portionSize: z.enum(["small", "medium", "large"])
});

export const mealCheckinInputSchema = z.object({
  sessionId: nonEmptyString,
  date: isoDateSchema,
  slot: z.enum(["breakfast", "lunch", "dinner", "dinner2"]),
  completed: z.boolean(),
  templateId: nonEmptyString.optional()
});

export const mealCheckinUpdateSchema = z
  .object({
    sessionId: nonEmptyString,
    id: nonEmptyString,
    date: isoDateSchema.optional(),
    slot: z.enum(["breakfast", "lunch", "dinner", "dinner2"]).optional(),
    completed: z.boolean().optional(),
    templateId: nonEmptyString.optional()
  })
  .refine(
    (value) =>
      value.date !== undefined ||
      value.slot !== undefined ||
      value.completed !== undefined ||
      value.templateId !== undefined,
    {
      message: "At least one field is required"
    }
  );

export const quickMealLogUpdateSchema = z
  .object({
    sessionId: nonEmptyString,
    id: nonEmptyString,
    date: isoDateSchema.optional(),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
    foodLabel: nonEmptyString.max(120).optional(),
    portionSize: z.enum(["small", "medium", "large"]).optional()
  })
  .refine(
    (value) =>
      value.date !== undefined ||
      value.mealType !== undefined ||
      value.foodLabel !== undefined ||
      value.portionSize !== undefined,
    {
      message: "At least one field is required"
    }
  );

export const quickWorkoutLogInputSchema = z.object({
  sessionId: nonEmptyString,
  date: isoDateSchema,
  bodyPart: z.enum(["chest", "back", "legs", "core", "shoulders", "arms", "full_body", "cardio"]),
  purpose: z.enum(["muscle_gain", "fat_loss", "endurance", "mobility", "recovery"]),
  tool: z.enum(["bodyweight", "dumbbell", "machine", "barbell", "kettlebell", "mixed"]),
  exerciseName: nonEmptyString.max(120),
  templateId: nonEmptyString.optional(),
  sets: z.number().int().min(1).max(20).optional(),
  reps: z.number().int().min(1).max(100).optional(),
  weightKg: z.number().min(0).max(500).optional(),
  durationMinutes: z.number().int().min(1).max(300).optional(),
  intensity: z.enum(["low", "medium", "high"]).default("medium")
});

export const quickWorkoutLogUpdateSchema = z
  .object({
    sessionId: nonEmptyString,
    id: nonEmptyString,
    date: isoDateSchema.optional(),
    bodyPart: z.enum(["chest", "back", "legs", "core", "shoulders", "arms", "full_body", "cardio"]).optional(),
    purpose: z.enum(["muscle_gain", "fat_loss", "endurance", "mobility", "recovery"]).optional(),
    tool: z.enum(["bodyweight", "dumbbell", "machine", "barbell", "kettlebell", "mixed"]).optional(),
    exerciseName: nonEmptyString.max(120).optional(),
    templateId: nonEmptyString.optional(),
    sets: z.number().int().min(1).max(20).optional(),
    reps: z.number().int().min(1).max(100).optional(),
    weightKg: z.number().min(0).max(500).optional(),
    durationMinutes: z.number().int().min(1).max(300).optional(),
    intensity: z.enum(["low", "medium", "high"]).optional()
  })
  .refine(
    (value) =>
      value.date !== undefined ||
      value.bodyPart !== undefined ||
      value.purpose !== undefined ||
      value.tool !== undefined ||
      value.exerciseName !== undefined ||
      value.templateId !== undefined ||
      value.sets !== undefined ||
      value.reps !== undefined ||
      value.weightKg !== undefined ||
      value.durationMinutes !== undefined ||
      value.intensity !== undefined,
    {
      message: "At least one field is required"
    }
  );

export const bodyMetricInputSchema = z
  .object({
    sessionId: nonEmptyString,
    date: isoDateSchema,
    weightKg: z.number().min(0).max(400).optional(),
    bodyFatPct: z.number().min(1).max(70).optional()
  })
  .refine((value) => value.weightKg !== undefined || value.bodyFatPct !== undefined, {
    message: "At least one metric is required"
  });

export const bodyMetricUpdateSchema = z
  .object({
    sessionId: nonEmptyString,
    id: nonEmptyString,
    date: isoDateSchema.optional(),
    weightKg: z.number().min(0).max(400).optional(),
    bodyFatPct: z.number().min(1).max(70).optional()
  })
  .refine(
    (value) => value.date !== undefined || value.weightKg !== undefined || value.bodyFatPct !== undefined,
    {
      message: "At least one field is required"
    }
  );

export const goalInputSchema = z.object({
  sessionId: nonEmptyString,
  dDay: isoDateSchema.optional(),
  targetWeightKg: z.number().min(0).max(400).optional(),
  targetBodyFat: z.number().min(1).max(70).optional(),
  weeklyRoutineTarget: z.number().int().min(1).max(21)
});
export const goalQuerySchema = z.object({
  sessionId: nonEmptyString
});

export const calendarDayQuerySchema = z.object({
  sessionId: nonEmptyString,
  date: isoDateSchema
});

export const calendarRangeQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema
  })
  .refine((value) => value.from <= value.to, {
    message: "from must be less than or equal to to",
    path: ["from"]
  });

export const dashboardQuerySchema = z.object({
  sessionId: nonEmptyString,
  range: rangeSchema.default("7d")
});

export const workspaceViewSchema = z.enum(["dashboard", "records", "settings"]);

export const bootstrapQuerySchema = z.object({
  sessionId: nonEmptyString.optional(),
  view: workspaceViewSchema.default("dashboard"),
  date: isoDateSchema.optional(),
  range: rangeSchema.default("7d")
});

export const bootstrapResponseSchema = z.object({
  session: z
    .object({
      sessionId: nonEmptyString,
      userId: nonEmptyString,
      isGuest: z.boolean(),
      createdAt: z.string(),
      upgradedAt: z.string().optional(),
      email: z.string().email().optional(),
      authProvider: z.enum(["guest", "google"]).optional(),
      providerSubject: nonEmptyString.optional(),
      avatarUrl: z.string().url().optional()
    })
    .nullable(),
  dashboard: z.unknown().optional(),
  day: z.unknown().optional(),
  goal: z.unknown().nullable().optional(),
  mealTemplates: z.array(z.unknown()).optional(),
  workoutTemplates: z.array(z.unknown()).optional(),
  reminderSettings: z.unknown().nullable().optional(),
  fetchedAt: z.string()
});

export const reminderChannelSchema = z.enum(["web_in_app", "web_push", "mobile_local"]);

export const reminderSettingsQuerySchema = z.object({
  sessionId: nonEmptyString
});

export const reminderSettingsInputSchema = z.object({
  sessionId: nonEmptyString,
  isEnabled: z.boolean(),
  dailyReminderTime: hhmmSchema,
  missingLogReminderTime: hhmmSchema,
  channels: z.array(reminderChannelSchema).min(1),
  timezone: nonEmptyString
});

export const reminderEvaluateQuerySchema = z.object({
  sessionId: nonEmptyString,
  date: isoDateSchema
});

export const workoutSuggestionQuerySchema = z.object({
  bodyPart: z.enum(["chest", "back", "legs", "core", "shoulders", "arms", "full_body", "cardio"]),
  purpose: z.enum(["muscle_gain", "fat_loss", "endurance", "mobility", "recovery"]).optional(),
  tool: z.enum(["bodyweight", "dumbbell", "machine", "barbell", "kettlebell", "mixed"]).optional()
});

export const softDeleteSchema = z.object({
  sessionId: nonEmptyString,
  id: nonEmptyString
});

export const mealTemplateInputSchema = z.object({
  sessionId: nonEmptyString,
  label: nonEmptyString.max(120),
  mealSlot: z.enum(["breakfast", "lunch", "dinner", "dinner2"]),
  isActive: z.boolean().default(true)
});

export const mealTemplateUpdateSchema = z
  .object({
    sessionId: nonEmptyString,
    id: nonEmptyString,
    label: nonEmptyString.max(120).optional(),
    mealSlot: z.enum(["breakfast", "lunch", "dinner", "dinner2"]).optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => value.label !== undefined || value.mealSlot !== undefined || value.isActive !== undefined, {
    message: "At least one field is required"
  });

export const workoutTemplateInputSchema = z.object({
  sessionId: nonEmptyString,
  label: nonEmptyString.max(120),
  bodyPart: z.enum(["chest", "back", "legs", "core", "shoulders", "arms", "full_body", "cardio"]),
  purpose: z.enum(["muscle_gain", "fat_loss", "endurance", "mobility", "recovery"]),
  tool: z.enum(["bodyweight", "dumbbell", "machine", "barbell", "kettlebell", "mixed"]),
  defaultDuration: z.number().int().min(1).max(300).optional(),
  isActive: z.boolean().default(true)
});

export const workoutTemplateUpdateSchema = z
  .object({
    sessionId: nonEmptyString,
    id: nonEmptyString,
    label: nonEmptyString.max(120).optional(),
    bodyPart: z.enum(["chest", "back", "legs", "core", "shoulders", "arms", "full_body", "cardio"]).optional(),
    purpose: z.enum(["muscle_gain", "fat_loss", "endurance", "mobility", "recovery"]).optional(),
    tool: z.enum(["bodyweight", "dumbbell", "machine", "barbell", "kettlebell", "mixed"]).optional(),
    defaultDuration: z.number().int().min(1).max(300).optional(),
    isActive: z.boolean().optional()
  })
  .refine(
    (value) =>
      value.label !== undefined ||
      value.bodyPart !== undefined ||
      value.purpose !== undefined ||
      value.tool !== undefined ||
      value.defaultDuration !== undefined ||
      value.isActive !== undefined,
    {
      message: "At least one field is required"
    }
  );

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "body";
    return `${path}: ${issue.message}`;
  });
}

export type AuthGuestRequest = z.infer<typeof authGuestRequestSchema>;
export type AuthUpgradeRequest = z.infer<typeof authUpgradeRequestSchema>;
export type GoogleUpgradeRequest = z.infer<typeof googleUpgradeRequestSchema>;
export type GoogleSessionRequest = z.infer<typeof googleSessionRequestSchema>;
export type QuickMealLogRequest = z.infer<typeof quickMealLogInputSchema>;
export type MealCheckinRequest = z.infer<typeof mealCheckinInputSchema>;
export type MealCheckinUpdateRequest = z.infer<typeof mealCheckinUpdateSchema>;
export type QuickMealLogUpdateRequest = z.infer<typeof quickMealLogUpdateSchema>;
export type QuickWorkoutLogRequest = z.infer<typeof quickWorkoutLogInputSchema>;
export type QuickWorkoutLogUpdateRequest = z.infer<typeof quickWorkoutLogUpdateSchema>;
export type BodyMetricRequest = z.infer<typeof bodyMetricInputSchema>;
export type BodyMetricUpdateRequest = z.infer<typeof bodyMetricUpdateSchema>;
export type GoalRequest = z.infer<typeof goalInputSchema>;
export type GoalQuery = z.infer<typeof goalQuerySchema>;
export type CalendarDayQuery = z.infer<typeof calendarDayQuerySchema>;
export type CalendarRangeQuery = z.infer<typeof calendarRangeQuerySchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type BootstrapQuery = z.infer<typeof bootstrapQuerySchema>;
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
export type WorkoutSuggestionQuery = z.infer<typeof workoutSuggestionQuerySchema>;
export type SoftDeleteRequest = z.infer<typeof softDeleteSchema>;
export type MealTemplateRequest = z.infer<typeof mealTemplateInputSchema>;
export type MealTemplateUpdateRequest = z.infer<typeof mealTemplateUpdateSchema>;
export type WorkoutTemplateRequest = z.infer<typeof workoutTemplateInputSchema>;
export type WorkoutTemplateUpdateRequest = z.infer<typeof workoutTemplateUpdateSchema>;
export type ReminderSettingsQuery = z.infer<typeof reminderSettingsQuerySchema>;
export type ReminderSettingsRequest = z.infer<typeof reminderSettingsInputSchema>;
export type ReminderEvaluateQuery = z.infer<typeof reminderEvaluateQuerySchema>;
