export type SessionSnapshotLike = {
  sessionId: string;
  userId: string;
};

export type ReminderStateLike = {
  isEnabled: boolean;
  dailyReminderTime: string;
  missingLogReminderTime: string;
  channels: string[];
  timezone: string;
};

export function buildSessionSnapshotKey(session: SessionSnapshotLike | null | undefined): string | null {
  if (!session) {
    return null;
  }
  return `${session.userId}:${session.sessionId}`;
}

export function resolveBootstrapReminderSettings<T extends ReminderStateLike>(
  value: T | null | undefined,
  defaults: T
): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value ?? defaults;
}
