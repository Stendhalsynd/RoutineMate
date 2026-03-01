#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const NOTION_VERSION = "2022-06-28";
const NOTION_BASE_URL = "https://api.notion.com/v1";

const cwd = process.cwd();
const envFile = path.join(cwd, ".env");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq < 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(envFile);

const token = process.env.NOTION_TOKEN?.trim();
if (!token) {
  console.error("[FAIL] Missing env: NOTION_TOKEN");
  process.exit(1);
}

const schemas = [
  {
    label: "Sessions",
    envKey: "NOTION_DB_SESSIONS",
    required: ["Name", "UserId", "IsGuest", "CreatedAt"],
    optional: ["Email", "UpgradedAt", "AuthProvider", "ProviderSubject", "AvatarUrl"]
  },
  {
    label: "Meals",
    envKey: "NOTION_DB_MEALS",
    required: ["Name", "Id", "UserId", "Date", "MealSlot", "Completed", "IsDeleted", "DeletedAt", "CreatedAt"],
    optional: ["FoodLabel", "MealType", "PortionSize", "TemplateId"]
  },
  {
    label: "Workouts",
    envKey: "NOTION_DB_WORKOUTS",
    required: [
      "Name",
      "Id",
      "UserId",
      "Date",
      "BodyPart",
      "Purpose",
      "Tool",
      "ExerciseName",
      "Intensity",
      "IsDeleted",
      "DeletedAt",
      "CreatedAt"
    ],
    optional: ["Sets", "Reps", "WeightKg", "DurationMinutes", "TemplateId"]
  },
  {
    label: "BodyMetrics",
    envKey: "NOTION_DB_BODY_METRICS",
    required: ["Name", "Id", "UserId", "Date", "IsDeleted", "DeletedAt", "CreatedAt"],
    optional: ["WeightKg", "BodyFatPct"]
  },
  {
    label: "Goals",
    envKey: "NOTION_DB_GOALS",
    required: ["Name", "Id", "UserId", "WeeklyRoutineTarget", "CreatedAt"],
    optional: ["DDay", "TargetWeightKg", "TargetBodyFat"]
  },
  {
    label: "MealTemplates",
    envKey: "NOTION_DB_MEAL_TEMPLATES",
    required: ["Name", "Id", "UserId", "Label", "MealSlot", "IsActive", "CreatedAt"],
    optional: []
  },
  {
    label: "WorkoutTemplates",
    envKey: "NOTION_DB_WORKOUT_TEMPLATES",
    required: ["Name", "Id", "UserId", "Label", "BodyPart", "Purpose", "Tool", "IsActive", "CreatedAt"],
    optional: ["DefaultDuration"]
  },
  {
    label: "ReminderSettings",
    envKey: "NOTION_DB_REMINDER_SETTINGS",
    required: [
      "Name",
      "Id",
      "UserId",
      "IsEnabled",
      "DailyReminderTime",
      "MissingLogReminderTime",
      "Channels",
      "Timezone",
      "CreatedAt",
      "UpdatedAt"
    ],
    optional: []
  }
];

async function fetchDatabase(databaseId) {
  const response = await fetch(`${NOTION_BASE_URL}/databases/${databaseId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.message ?? `Notion API ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

let hasFailure = false;

for (const schema of schemas) {
  const databaseId = process.env[schema.envKey]?.trim();
  if (!databaseId) {
    console.error(`[FAIL] ${schema.label}: missing env ${schema.envKey}`);
    hasFailure = true;
    continue;
  }

  try {
    const database = await fetchDatabase(databaseId);
    const properties = Object.keys(database.properties ?? {});
    const missingRequired = schema.required.filter((field) => !properties.includes(field));
    const missingOptional = schema.optional.filter((field) => !properties.includes(field));

    if (missingRequired.length > 0) {
      console.error(`[FAIL] ${schema.label}: missing required -> ${missingRequired.join(", ")}`);
      hasFailure = true;
      continue;
    }

    if (missingOptional.length > 0) {
      console.warn(`[WARN] ${schema.label}: missing optional -> ${missingOptional.join(", ")}`);
    }

    console.log(`[PASS] ${schema.label}: required ${schema.required.length} OK`);
  } catch (error) {
    console.error(`[FAIL] ${schema.label}: ${error instanceof Error ? error.message : String(error)}`);
    hasFailure = true;
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log("\nNotion schema check complete: ALL REQUIRED FIELDS OK");
