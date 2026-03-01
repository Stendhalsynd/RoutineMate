type NotionDatabaseConfig = {
  sessionsDbId: string;
  mealsDbId: string;
  workoutsDbId: string;
  bodyMetricsDbId: string;
  goalsDbId: string;
  mealTemplatesDbId?: string;
  workoutTemplatesDbId?: string;
  reminderSettingsDbId?: string;
};

type NotionConfig = {
  token: string;
  databases: NotionDatabaseConfig;
};

type NotionQueryResult = {
  results: unknown[];
  has_more: boolean;
  next_cursor: string | null;
};

const NOTION_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function ensureConfig(): NotionConfig {
  const token = process.env.NOTION_TOKEN?.trim();
  const sessionsDbId = process.env.NOTION_DB_SESSIONS?.trim();
  const mealsDbId = process.env.NOTION_DB_MEALS?.trim();
  const workoutsDbId = process.env.NOTION_DB_WORKOUTS?.trim();
  const bodyMetricsDbId = process.env.NOTION_DB_BODY_METRICS?.trim();
  const goalsDbId = process.env.NOTION_DB_GOALS?.trim();
  const mealTemplatesDbId = process.env.NOTION_DB_MEAL_TEMPLATES?.trim();
  const workoutTemplatesDbId = process.env.NOTION_DB_WORKOUT_TEMPLATES?.trim();
  const reminderSettingsDbId = process.env.NOTION_DB_REMINDER_SETTINGS?.trim();

  const missing: string[] = [];
  if (!token) {
    missing.push("NOTION_TOKEN");
  }
  if (!sessionsDbId) {
    missing.push("NOTION_DB_SESSIONS");
  }
  if (!mealsDbId) {
    missing.push("NOTION_DB_MEALS");
  }
  if (!workoutsDbId) {
    missing.push("NOTION_DB_WORKOUTS");
  }
  if (!bodyMetricsDbId) {
    missing.push("NOTION_DB_BODY_METRICS");
  }
  if (!goalsDbId) {
    missing.push("NOTION_DB_GOALS");
  }

  if (missing.length > 0) {
    throw new Error(`Notion integration is not configured. Missing env: ${missing.join(", ")}`);
  }

  return {
    token: token!,
    databases: {
      sessionsDbId: sessionsDbId!,
      mealsDbId: mealsDbId!,
      workoutsDbId: workoutsDbId!,
      bodyMetricsDbId: bodyMetricsDbId!,
      goalsDbId: goalsDbId!,
      ...(mealTemplatesDbId ? { mealTemplatesDbId } : {}),
      ...(workoutTemplatesDbId ? { workoutTemplatesDbId } : {}),
      ...(reminderSettingsDbId ? { reminderSettingsDbId } : {})
    }
  };
}

async function notionRequest(path: string, method: string, body?: unknown): Promise<unknown> {
  const config = ensureConfig();
  const requestInit: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  };
  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }
  const response = await fetch(`${NOTION_BASE_URL}${path}`, {
    ...requestInit
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(errorPayload?.message ?? `Notion API request failed (${response.status})`);
  }

  return (await response.json()) as unknown;
}

export function getNotionDatabases(): NotionDatabaseConfig {
  return ensureConfig().databases;
}

export async function queryDatabasePages(databaseId: string, payload?: Record<string, unknown>): Promise<unknown[]> {
  const results: unknown[] = [];
  let nextCursor: string | null = null;

  do {
    const response = (await notionRequest(`/databases/${databaseId}/query`, "POST", {
      page_size: 100,
      ...(payload ?? {}),
      ...(nextCursor ? { start_cursor: nextCursor } : {})
    })) as NotionQueryResult;

    results.push(...response.results);
    nextCursor = response.has_more ? response.next_cursor : null;
  } while (nextCursor);

  return results;
}

export async function createDatabasePage(databaseId: string, properties: Record<string, unknown>): Promise<unknown> {
  return notionRequest("/pages", "POST", {
    parent: { database_id: databaseId },
    properties
  });
}

export async function updateDatabasePage(pageId: string, properties: Record<string, unknown>): Promise<unknown> {
  return notionRequest(`/pages/${pageId}`, "PATCH", {
    properties
  });
}

export async function readDatabase(databaseId: string): Promise<unknown> {
  return notionRequest(`/databases/${databaseId}`, "GET");
}
