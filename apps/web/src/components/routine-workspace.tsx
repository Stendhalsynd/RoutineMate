"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BodyMetric,
  BodyPart,
  BootstrapPayload,
  DashboardBucket,
  DashboardSummary,
  DaySnapshot,
  Goal,
  MealCheckin,
  ReminderChannel,
  ReminderEvaluation,
  ReminderSettings,
  MealSlot,
  MealTemplate,
  RangeKey,
  Session,
  WorkoutLog,
  WorkoutSlot,
  WorkoutPurpose,
  WorkoutTemplate,
  WorkoutTool,
  WorkspaceView
} from "@routinemate/domain";

type MessageType = "error" | "success" | "info";
type Message = { type: MessageType; text: string };

type GoalForm = {
  weeklyRoutineTarget: string;
  dDay: string;
  targetWeightKg: string;
  targetBodyFat: string;
};

type BodyMetricForm = {
  date: string;
  weightKg: string;
  bodyFatPct: string;
};

type ReminderForm = {
  isEnabled: boolean;
  dailyReminderTime: string;
  missingLogReminderTime: string;
  channels: ReminderChannel[];
  timezone: string;
};

const ranges: RangeKey[] = ["7d", "30d", "90d"];

const rangeLabels: Record<RangeKey, "Day" | "Week" | "Month"> = {
  "7d": "Day",
  "30d": "Week",
  "90d": "Month"
};

const mealSlots: Array<{ value: MealSlot; label: string }> = [
  { value: "breakfast", label: "아침" },
  { value: "lunch", label: "점심" },
  { value: "dinner", label: "저녁" },
  { value: "dinner2", label: "저녁2" }
];

const workoutSlots: Array<{ value: WorkoutSlot; label: string }> = [
  { value: "am", label: "오전" },
  { value: "pm", label: "오후" }
];

function defaultWorkoutBySlot(slot: WorkoutSlot): {
  bodyPart: BodyPart;
  purpose: WorkoutPurpose;
  tool: WorkoutTool;
  exerciseName: string;
  durationMinutes: number;
  intensity: NonNullable<WorkoutLog["intensity"]>;
} {
  return {
    bodyPart: "full_body",
    purpose: "fat_loss",
    tool: "bodyweight",
    exerciseName: slot === "am" ? "오전 운동 체크" : "오후 운동 체크",
    durationMinutes: slot === "am" ? 20 : 30,
    intensity: "medium"
  };
}

const bodyPartOptions: Array<{ value: BodyPart; label: string }> = [
  { value: "chest", label: "가슴" },
  { value: "back", label: "등" },
  { value: "legs", label: "하체" },
  { value: "core", label: "코어" },
  { value: "shoulders", label: "어깨" },
  { value: "arms", label: "팔" },
  { value: "full_body", label: "전신" },
  { value: "cardio", label: "유산소" }
];

const purposeOptions: Array<{ value: WorkoutPurpose; label: string }> = [
  { value: "muscle_gain", label: "근비대" },
  { value: "fat_loss", label: "체지방 감량" },
  { value: "endurance", label: "지구력" },
  { value: "mobility", label: "가동성" },
  { value: "recovery", label: "회복" }
];

const toolOptions: Array<{ value: WorkoutTool; label: string }> = [
  { value: "bodyweight", label: "맨몸" },
  { value: "dumbbell", label: "덤벨" },
  { value: "barbell", label: "바벨" },
  { value: "machine", label: "머신" },
  { value: "kettlebell", label: "케틀벨" },
  { value: "mixed", label: "혼합" }
];

const queryKeys = {
  session: ["session"] as const,
  bootstrap: (sessionId: string, view: WorkspaceView, date: string, range: RangeKey) =>
    ["bootstrap", sessionId, view, date, range] as const,
  dashboard: (sessionId: string, range: RangeKey) => ["dashboard", sessionId, range] as const,
  day: (sessionId: string, date: string) => ["day", sessionId, date] as const,
  goal: (sessionId: string) => ["goal", sessionId] as const,
  reminderSettings: (sessionId: string) => ["reminderSettings", sessionId] as const,
  reminderEval: (sessionId: string, date: string) => ["reminderEval", sessionId, date] as const,
  mealTemplates: (sessionId: string) => ["mealTemplates", sessionId] as const,
  workoutTemplates: (sessionId: string) => ["workoutTemplates", sessionId] as const
};

function todayYmd(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function defaultDaySnapshot(date: string): DaySnapshot {
  return {
    date,
    mealCheckins: [],
    workoutLogs: [],
    bodyMetrics: []
  };
}

function parseNumber(value: string): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return payload?.error?.message ?? fallback;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) {
    return "--";
  }
  return `${Math.round(value)}%`;
}

function formatBucketLabel(bucket: DashboardBucket, granularity: DashboardSummary["granularity"]): string {
  if (granularity === "day") {
    return bucket.label;
  }
  return `${bucket.label} (${bucket.from.slice(5)}~${bucket.to.slice(5)})`;
}

function formatDday(daysToDday?: number): string {
  if (daysToDday === undefined) {
    return "미설정";
  }
  if (daysToDday > 0) {
    return `D-${daysToDday}`;
  }
  if (daysToDday === 0) {
    return "D-Day";
  }
  return `D+${Math.abs(daysToDday)}`;
}

type MetricTrendChartProps = {
  title: string;
  unit: string;
  colorClassName: string;
  points: Array<{ date: string; value: number }>;
};

function MetricTrendChart({ title, unit, colorClassName, points }: MetricTrendChartProps) {
  if (points.length === 0) {
    return (
      <article className="metric-trend-card">
        <h4>{title}</h4>
        <p className="hint">기록이 쌓이면 라인차트를 표시합니다.</p>
      </article>
    );
  }

  const width = 680;
  const height = 220;
  const padding = { top: 20, right: 16, bottom: 34, left: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = points.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const valueRange = max - min || 1;
  const total = points.length;

  const coords = points.map((point, index) => {
    const x =
      total === 1
        ? padding.left + plotWidth / 2
        : padding.left + (index / Math.max(total - 1, 1)) * plotWidth;
    const y = padding.top + ((max - point.value) / valueRange) * plotHeight;
    return { x, y, point };
  });

  const line = coords
    .map((item, index) => `${index === 0 ? "M" : "L"}${item.x.toFixed(2)} ${item.y.toFixed(2)}`)
    .join(" ");

  const firstDate = points[0]?.date ?? "";
  const lastDate = points[points.length - 1]?.date ?? "";
  const latest = points[points.length - 1]?.value;

  return (
    <article className="metric-trend-card">
      <div className="metric-trend-head">
        <h4>{title}</h4>
        <p className="metric-trend-latest">{latest !== undefined ? `${latest.toFixed(1)}${unit}` : "--"}</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="metric-trend-svg" role="img" aria-label={`${title} 라인차트`}>
        <rect x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} className="metric-grid-bg" />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + plotHeight}
          className="metric-axis-line"
        />
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight}
          className="metric-axis-line"
        />
        <path d={line} className={`metric-line ${colorClassName}`} />
        {coords.map((item) => (
          <circle
            key={`${title}-${item.point.date}`}
            cx={item.x}
            cy={item.y}
            r={3}
            className={`metric-dot ${colorClassName}`}
          />
        ))}
      </svg>
      <p className="metric-trend-range">
        {firstDate} ~ {lastDate}
      </p>
    </article>
  );
}

function buildDecimalOptions(min: number, max: number, step: number): string[] {
  const options: string[] = [];
  for (let value = min; value <= max + 0.00001; value += step) {
    options.push(value.toFixed(1));
  }
  return options;
}

function buildIntegerOptions(min: number, max: number): string[] {
  const options: string[] = [];
  for (let value = min; value <= max; value += 1) {
    options.push(String(value));
  }
  return options;
}

function DateField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field full-span date-field">
      <span>{label}</span>
      <div className="date-field-control">
        <span>{value || "날짜 선택"}</span>
      </div>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  suffix,
  allowEmpty = true
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  suffix?: string;
  allowEmpty?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {allowEmpty ? <option value="">미설정</option> : null}
        {options.map((item) => (
          <option key={item} value={item}>
            {suffix ? `${item}${suffix}` : item}
          </option>
        ))}
      </select>
    </label>
  );
}

async function fetchSession(): Promise<Session | null> {
  const response = await fetch("/api/v1/auth/session");
  if (!response.ok) {
    const message = await parseErrorMessage(response, "세션 확인에 실패했습니다.");
    throw new Error(message);
  }
  const payload = (await response.json()) as { data?: Session | null };
  return payload.data ?? null;
}

async function fetchGoal(sessionId: string): Promise<Goal | null> {
  const response = await fetch(`/api/v1/goals?sessionId=${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "목표 조회에 실패했습니다."));
  }
  const payload = (await response.json()) as { data?: { goal?: Goal | null } };
  return payload.data?.goal ?? null;
}

async function fetchDay(sessionId: string, date: string): Promise<DaySnapshot> {
  const response = await fetch(
    `/api/v1/calendar/day?sessionId=${encodeURIComponent(sessionId)}&date=${encodeURIComponent(date)}`
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "기록 조회에 실패했습니다."));
  }
  const payload = (await response.json()) as { data?: DaySnapshot };
  return payload.data ?? defaultDaySnapshot(date);
}

async function fetchMealTemplates(sessionId: string): Promise<MealTemplate[]> {
  const response = await fetch(`/api/v1/templates/meals?sessionId=${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "식단 템플릿 조회에 실패했습니다."));
  }
  const payload = (await response.json()) as { data?: { templates?: MealTemplate[] } };
  return payload.data?.templates ?? [];
}

async function fetchWorkoutTemplates(sessionId: string): Promise<WorkoutTemplate[]> {
  const response = await fetch(`/api/v1/templates/workouts?sessionId=${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "운동 템플릿 조회에 실패했습니다."));
  }
  const payload = (await response.json()) as { data?: { templates?: WorkoutTemplate[] } };
  return payload.data?.templates ?? [];
}

async function fetchReminderSettings(sessionId: string): Promise<ReminderSettings | null> {
  const response = await fetch(`/api/v1/reminders/settings?sessionId=${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "리마인더 설정 조회에 실패했습니다."));
  }
  const payload = (await response.json()) as { data?: { settings?: ReminderSettings | null } };
  return payload.data?.settings ?? null;
}

async function fetchReminderEvaluation(sessionId: string, date: string): Promise<ReminderEvaluation> {
  const response = await fetch(
    `/api/v1/reminders/evaluate?sessionId=${encodeURIComponent(sessionId)}&date=${encodeURIComponent(date)}`
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "리마인더 평가 조회에 실패했습니다."));
  }
  const payload = (await response.json()) as { data?: ReminderEvaluation };
  return (
    payload.data ?? {
      date,
      mealCount: 0,
      workoutCount: 0,
      bodyMetricCount: 0,
      isMissingLogCandidate: true
    }
  );
}

async function fetchGoogleWebClientId(): Promise<string> {
  const response = await fetch("/api/v1/auth/google/config");
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Google OAuth 구성이 누락되었습니다."));
  }
  const payload = (await response.json()) as { data?: { webClientId?: string } };
  const clientId = payload.data?.webClientId;
  if (!clientId) {
    throw new Error("Google OAuth 클라이언트 ID를 찾을 수 없습니다.");
  }
  return clientId;
}

async function fetchBootstrap(
  sessionId: string,
  view: WorkspaceView,
  date: string,
  range: RangeKey,
  fresh = false
): Promise<BootstrapPayload> {
  const response = await fetch(
    `/api/v1/bootstrap?sessionId=${encodeURIComponent(sessionId)}&view=${encodeURIComponent(view)}&date=${encodeURIComponent(
      date
    )}&range=${encodeURIComponent(range)}${fresh ? "&fresh=1" : ""}`
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "초기 데이터 조회에 실패했습니다."));
  }
  const payload = (await response.json()) as { data?: BootstrapPayload };
  return (
    payload.data ?? {
      session: null,
      fetchedAt: new Date().toISOString()
    }
  );
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: "popup" | "redirect";
          }) => void;
          prompt: (listener?: (notification: { isNotDisplayed?: () => boolean; isSkippedMoment?: () => boolean }) => void) => void;
        };
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function ensureGoogleScriptLoaded(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("브라우저 환경에서만 Google OAuth를 사용할 수 있습니다."));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

async function requestGoogleCredential(clientId: string): Promise<string> {
  await ensureGoogleScriptLoaded();

  return new Promise((resolve, reject) => {
    const api = window.google?.accounts?.id;
    if (!api) {
      reject(new Error("Google OAuth API를 찾을 수 없습니다."));
      return;
    }

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error("Google 인증 팝업이 응답하지 않았습니다."));
    }, 15_000);

    api.initialize({
      client_id: clientId,
      ux_mode: "popup",
      callback: (response) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeoutId);
        if (!response.credential) {
          reject(new Error("Google 인증 토큰을 가져오지 못했습니다."));
          return;
        }
        resolve(response.credential);
      }
    });

    api.prompt((notification) => {
      if (settled) {
        return;
      }
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        settled = true;
        window.clearTimeout(timeoutId);
        reject(new Error("Google 인증 UI를 표시하지 못했습니다."));
      }
    });
  });
}

export function RoutineWorkspace({ view }: { view: WorkspaceView }) {
  const queryClient = useQueryClient();

  const [range, setRange] = useState<RangeKey>("7d");
  const [selectedDate, setSelectedDate] = useState<string>(todayYmd());

  const [sessionMessage, setSessionMessage] = useState<Message | null>(null);
  const [dashboardMessage, setDashboardMessage] = useState<Message | null>(null);
  const [recordsMessage, setRecordsMessage] = useState<Message | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<Message | null>(null);

  const [goalForm, setGoalForm] = useState<GoalForm>({
    weeklyRoutineTarget: "4",
    dDay: "",
    targetWeightKg: "",
    targetBodyFat: ""
  });

  const [bodyMetricForm, setBodyMetricForm] = useState<BodyMetricForm>({
    date: todayYmd(),
    weightKg: "",
    bodyFatPct: ""
  });

  const [mealTemplateForm, setMealTemplateForm] = useState<{ label: string }>({
    label: ""
  });

  const [workoutTemplateForm, setWorkoutTemplateForm] = useState<{
    label: string;
    bodyPart: BodyPart;
    purpose: WorkoutPurpose;
    tool: WorkoutTool;
    defaultDuration: string;
  }>({
    label: "",
    bodyPart: "full_body",
    purpose: "fat_loss",
    tool: "bodyweight",
    defaultDuration: "30"
  });

  const [editingMealTemplateId, setEditingMealTemplateId] = useState<string | null>(null);
  const [editingMealTemplateDraft, setEditingMealTemplateDraft] = useState<{ label: string }>({
    label: ""
  });

  const [editingWorkoutTemplateId, setEditingWorkoutTemplateId] = useState<string | null>(null);
  const [editingWorkoutTemplateDraft, setEditingWorkoutTemplateDraft] = useState<{
    label: string;
    bodyPart: BodyPart;
    purpose: WorkoutPurpose;
    tool: WorkoutTool;
    defaultDuration: string;
  }>({
    label: "",
    bodyPart: "full_body",
    purpose: "fat_loss",
    tool: "bodyweight",
    defaultDuration: "30"
  });

  const [reminderForm, setReminderForm] = useState<ReminderForm>({
    isEnabled: true,
    dailyReminderTime: "20:00",
    missingLogReminderTime: "21:30",
    channels: ["web_in_app", "mobile_local"],
    timezone: "Asia/Seoul"
  });
  const [isGoogleUpgrading, setIsGoogleUpgrading] = useState(false);

  const weeklyTargetOptions = useMemo(() => buildIntegerOptions(1, 21), []);
  const weightOptions = useMemo(() => buildDecimalOptions(30, 200, 0.1), []);
  const bodyFatOptions = useMemo(() => buildDecimalOptions(3, 60, 0.1), []);

  const sessionQuery = useQuery({
    queryKey: queryKeys.session,
    queryFn: fetchSession,
    retry: false,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000
  });

  const session = sessionQuery.data ?? null;
  const sessionId = session?.sessionId;

  const goalQuery = useQuery({
    queryKey: queryKeys.goal(sessionId ?? ""),
    queryFn: () => fetchGoal(sessionId!),
    enabled: Boolean(sessionId) && view === "settings",
    staleTime: 300_000,
    placeholderData: keepPreviousData
  });

  const dayQuery = useQuery({
    queryKey: queryKeys.day(sessionId ?? "", selectedDate),
    queryFn: () => fetchDay(sessionId!, selectedDate),
    enabled: Boolean(sessionId) && view === "records",
    staleTime: 120_000,
    placeholderData: keepPreviousData
  });

  const mealTemplatesQuery = useQuery({
    queryKey: queryKeys.mealTemplates(sessionId ?? ""),
    queryFn: () => fetchMealTemplates(sessionId!),
    enabled: Boolean(sessionId) && (view === "records" || view === "settings"),
    staleTime: 300_000,
    placeholderData: keepPreviousData
  });

  const workoutTemplatesQuery = useQuery({
    queryKey: queryKeys.workoutTemplates(sessionId ?? ""),
    queryFn: () => fetchWorkoutTemplates(sessionId!),
    enabled: Boolean(sessionId) && (view === "records" || view === "settings"),
    staleTime: 300_000,
    placeholderData: keepPreviousData
  });

  const reminderSettingsQuery = useQuery({
    queryKey: queryKeys.reminderSettings(sessionId ?? ""),
    queryFn: () => fetchReminderSettings(sessionId!),
    enabled: Boolean(sessionId) && (view === "settings" || view === "records"),
    staleTime: 300_000,
    placeholderData: keepPreviousData
  });

  const reminderEvaluationQuery = useQuery({
    queryKey: queryKeys.reminderEval(sessionId ?? "", selectedDate),
    queryFn: () => fetchReminderEvaluation(sessionId!, selectedDate),
    enabled: Boolean(sessionId) && view === "records",
    staleTime: 30_000,
    placeholderData: keepPreviousData
  });

  const bootstrapQuery = useQuery({
    queryKey: queryKeys.bootstrap(sessionId ?? "", view, selectedDate, range),
    queryFn: () => fetchBootstrap(sessionId!, view, selectedDate, range),
    enabled: Boolean(sessionId),
    staleTime: 120_000,
    placeholderData: keepPreviousData
  });

  useEffect(() => {
    if (!(sessionQuery.error instanceof Error)) {
      return;
    }
    setSessionMessage({ type: "error", text: sessionQuery.error.message });
  }, [sessionQuery.error]);

  useEffect(() => {
    if (!(bootstrapQuery.error instanceof Error) || view !== "dashboard") {
      return;
    }
    setDashboardMessage({ type: "error", text: bootstrapQuery.error.message });
  }, [bootstrapQuery.error, view]);

  useEffect(() => {
    if (!(dayQuery.error instanceof Error)) {
      return;
    }
    setRecordsMessage({ type: "error", text: dayQuery.error.message });
  }, [dayQuery.error]);

  useEffect(() => {
    if (!(reminderEvaluationQuery.error instanceof Error)) {
      return;
    }
    setRecordsMessage({ type: "error", text: reminderEvaluationQuery.error.message });
  }, [reminderEvaluationQuery.error]);

  useEffect(() => {
    if (
      !(mealTemplatesQuery.error instanceof Error) &&
      !(workoutTemplatesQuery.error instanceof Error) &&
      !(goalQuery.error instanceof Error) &&
      !(reminderSettingsQuery.error instanceof Error)
    ) {
      return;
    }
    const message =
      (mealTemplatesQuery.error instanceof Error && mealTemplatesQuery.error.message) ||
      (workoutTemplatesQuery.error instanceof Error && workoutTemplatesQuery.error.message) ||
      (reminderSettingsQuery.error instanceof Error && reminderSettingsQuery.error.message) ||
      (goalQuery.error instanceof Error && goalQuery.error.message) ||
      "설정 데이터 조회에 실패했습니다.";
    setSettingsMessage({ type: "error", text: message });
  }, [goalQuery.error, mealTemplatesQuery.error, workoutTemplatesQuery.error, reminderSettingsQuery.error]);

  useEffect(() => {
    if (!sessionId || !bootstrapQuery.data) {
      return;
    }
    if (bootstrapQuery.data.dashboard) {
      queryClient.setQueryData(queryKeys.dashboard(sessionId, range), bootstrapQuery.data.dashboard);
    }
    if (bootstrapQuery.data.day) {
      queryClient.setQueryData(queryKeys.day(sessionId, bootstrapQuery.data.day.date), bootstrapQuery.data.day);
    }
    if (bootstrapQuery.data.goal !== undefined) {
      queryClient.setQueryData(queryKeys.goal(sessionId), bootstrapQuery.data.goal);
    }
    if (bootstrapQuery.data.mealTemplates) {
      queryClient.setQueryData(queryKeys.mealTemplates(sessionId), bootstrapQuery.data.mealTemplates);
    }
    if (bootstrapQuery.data.workoutTemplates) {
      queryClient.setQueryData(queryKeys.workoutTemplates(sessionId), bootstrapQuery.data.workoutTemplates);
    }
    if (bootstrapQuery.data.reminderSettings !== undefined) {
      queryClient.setQueryData(queryKeys.reminderSettings(sessionId), bootstrapQuery.data.reminderSettings);
    }
  }, [bootstrapQuery.data, queryClient, range, sessionId]);

  useEffect(() => {
    if (!sessionId || view !== "dashboard") {
      return;
    }
    for (const targetRange of ranges) {
      if (targetRange === range) {
        continue;
      }
      void queryClient.prefetchQuery({
        queryKey: queryKeys.bootstrap(sessionId, "dashboard", selectedDate, targetRange),
        queryFn: () => fetchBootstrap(sessionId, "dashboard", selectedDate, targetRange),
        staleTime: 120_000
      });
    }
  }, [queryClient, range, selectedDate, sessionId, view]);

  useEffect(() => {
    setBodyMetricForm((prev) => ({ ...prev, date: selectedDate }));
  }, [selectedDate]);

  const dashboard = ((view === "dashboard" ? bootstrapQuery.data?.dashboard : null) ?? null) as DashboardSummary | null;
  const goal = ((view === "settings" ? goalQuery.data : bootstrapQuery.data?.goal) ?? null) as Goal | null;
  const dayData = (dayQuery.data ?? defaultDaySnapshot(selectedDate)) as DaySnapshot;
  const mealTemplates = (mealTemplatesQuery.data ?? []) as MealTemplate[];
  const workoutTemplates = (workoutTemplatesQuery.data ?? []) as WorkoutTemplate[];
  const reminderSettings = (reminderSettingsQuery.data ?? null) as ReminderSettings | null;
  const reminderEvaluation = (reminderEvaluationQuery.data ?? null) as ReminderEvaluation | null;
  const weightTrendPoints = useMemo(
    () =>
      (dashboard?.bodyMetricTrend ?? [])
        .filter((item) => item.weightKg !== null)
        .map((item) => ({ date: item.date, value: item.weightKg as number })),
    [dashboard?.bodyMetricTrend]
  );
  const bodyFatTrendPoints = useMemo(
    () =>
      (dashboard?.bodyMetricTrend ?? [])
        .filter((item) => item.bodyFatPct !== null)
        .map((item) => ({ date: item.date, value: item.bodyFatPct as number })),
    [dashboard?.bodyMetricTrend]
  );
  const isSyncing = (() => {
    if (view === "dashboard") {
      return sessionQuery.isFetching || bootstrapQuery.isFetching;
    }
    if (view === "records") {
      return sessionQuery.isFetching || dayQuery.isFetching || reminderEvaluationQuery.isFetching;
    }
    return (
      sessionQuery.isFetching ||
      goalQuery.isFetching ||
      mealTemplatesQuery.isFetching ||
      workoutTemplatesQuery.isFetching ||
      reminderSettingsQuery.isFetching
    );
  })();

  const goalSyncRef = useRef<string>("");
  useEffect(() => {
    if (!goal) {
      return;
    }
    const syncKey = [
      goal.id,
      goal.weeklyRoutineTarget,
      goal.dDay ?? "",
      goal.targetWeightKg ?? "",
      goal.targetBodyFat ?? ""
    ].join("|");

    if (goalSyncRef.current === syncKey) {
      return;
    }
    goalSyncRef.current = syncKey;
    setGoalForm({
      weeklyRoutineTarget: String(goal.weeklyRoutineTarget),
      dDay: goal.dDay ?? "",
      targetWeightKg: goal.targetWeightKg?.toString() ?? "",
      targetBodyFat: goal.targetBodyFat?.toString() ?? ""
    });
  }, [goal]);

  const reminderSyncRef = useRef<string>("");
  useEffect(() => {
    if (!reminderSettings) {
      return;
    }
    const syncKey = [
      reminderSettings.id,
      reminderSettings.isEnabled,
      reminderSettings.dailyReminderTime,
      reminderSettings.missingLogReminderTime,
      reminderSettings.channels.join(","),
      reminderSettings.timezone
    ].join("|");
    if (reminderSyncRef.current === syncKey) {
      return;
    }
    reminderSyncRef.current = syncKey;
    setReminderForm({
      isEnabled: reminderSettings.isEnabled,
      dailyReminderTime: reminderSettings.dailyReminderTime,
      missingLogReminderTime: reminderSettings.missingLogReminderTime,
      channels: reminderSettings.channels,
      timezone: reminderSettings.timezone
    });
  }, [reminderSettings]);

  const notifiedDateRef = useRef<string>("");
  useEffect(() => {
    if (view !== "records" || !reminderSettings?.isEnabled || !reminderEvaluation?.isMissingLogCandidate) {
      return;
    }
    if (!reminderSettings.channels.includes("web_push")) {
      return;
    }
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }
    if (notifiedDateRef.current === reminderEvaluation.date) {
      return;
    }
    notifiedDateRef.current = reminderEvaluation.date;
    new Notification("RoutineMate 리마인더", {
      body: `${reminderEvaluation.date} 기록이 비어 있습니다. 1탭으로 체크인해 주세요.`
    });
  }, [reminderEvaluation, reminderSettings, view]);

  const checkinBySlot = useMemo(() => {
    const map = new Map<MealSlot, MealCheckin>();
    for (const item of dayData.mealCheckins) {
      if (item.isDeleted) {
        continue;
      }
      const existing = map.get(item.slot);
      if (!existing || item.createdAt > existing.createdAt) {
        map.set(item.slot, item);
      }
    }
    return map;
  }, [dayData.mealCheckins]);

  const currentGoalLabel = useMemo(() => {
    if (!goal) {
      return "목표 미설정";
    }
    const weight = goal.targetWeightKg !== undefined ? `${goal.targetWeightKg}kg` : "-";
    const fat = goal.targetBodyFat !== undefined ? `${goal.targetBodyFat}%` : "-";
    return `주 ${goal.weeklyRoutineTarget}회 / 체중 ${weight} / 체지방 ${fat}`;
  }, [goal]);

  const activeMealTemplates = useMemo(() => mealTemplates.filter((item) => item.isActive), [mealTemplates]);
  const activeWorkoutTemplates = useMemo(() => workoutTemplates.filter((item) => item.isActive), [workoutTemplates]);
  const workoutCheckinBySlot = useMemo(() => {
    const map = new Map<WorkoutSlot, WorkoutLog>();
    for (const item of dayData.workoutLogs) {
      if (item.isDeleted || !item.workoutSlot) {
        continue;
      }
      const existing = map.get(item.workoutSlot);
      if (!existing || item.createdAt > existing.createdAt) {
        map.set(item.workoutSlot, item);
      }
    }
    return map;
  }, [dayData.workoutLogs]);

  function toggleReminderChannel(channel: ReminderChannel): void {
    setReminderForm((prev) => {
      const exists = prev.channels.includes(channel);
      const channels = exists ? prev.channels.filter((item) => item !== channel) : [...prev.channels, channel];
      return {
        ...prev,
        channels: channels.length > 0 ? channels : [channel]
      };
    });
  }

  async function saveReminderSettingsAction(): Promise<void> {
    if (!sessionId) {
      setSettingsMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
      return;
    }

    const key = queryKeys.reminderSettings(sessionId);
    const previous = (queryClient.getQueryData(key) as ReminderSettings | null | undefined) ?? reminderSettings;
    const optimistic: ReminderSettings = {
      id: previous?.id ?? `tmp-reminder-${Date.now()}`,
      userId: session?.userId ?? "temp-user",
      isEnabled: reminderForm.isEnabled,
      dailyReminderTime: reminderForm.dailyReminderTime,
      missingLogReminderTime: reminderForm.missingLogReminderTime,
      channels: reminderForm.channels,
      timezone: reminderForm.timezone.trim() || "Asia/Seoul",
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    queryClient.setQueryData(key, optimistic);
    setSettingsMessage({ type: "info", text: "리마인더 설정을 저장 중입니다..." });

    const response = await fetch("/api/v1/reminders/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        isEnabled: reminderForm.isEnabled,
        dailyReminderTime: reminderForm.dailyReminderTime,
        missingLogReminderTime: reminderForm.missingLogReminderTime,
        channels: reminderForm.channels,
        timezone: reminderForm.timezone.trim() || "Asia/Seoul"
      })
    });

    if (!response.ok) {
      queryClient.setQueryData(key, previous ?? null);
      setSettingsMessage({ type: "error", text: await parseErrorMessage(response, "리마인더 설정 저장에 실패했습니다.") });
      return;
    }

    const payload = (await response.json()) as { data?: ReminderSettings };
    if (payload.data) {
      queryClient.setQueryData(key, payload.data);
    }

    if (reminderForm.channels.includes("web_push") && typeof Notification !== "undefined") {
      void Notification.requestPermission();
    }

    setSettingsMessage({ type: "success", text: "리마인더 설정을 저장했습니다." });
  }

  async function upgradeWithGoogle(): Promise<void> {
    if (isGoogleUpgrading) {
      return;
    }

    setIsGoogleUpgrading(true);
    try {
      const clientId = await fetchGoogleWebClientId();
      const idToken = await requestGoogleCredential(clientId);
      const shouldUpgradeGuest = Boolean(sessionId) && session?.isGuest === true;
      const response = await fetch(shouldUpgradeGuest ? "/api/v1/auth/upgrade/google" : "/api/v1/auth/google/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(shouldUpgradeGuest ? { sessionId } : {}),
          idToken,
          platform: "web"
        })
      });

      if (!response.ok) {
        setSettingsMessage({ type: "error", text: await parseErrorMessage(response, "Google 로그인에 실패했습니다.") });
        return;
      }

      const payload = (await response.json()) as { data?: Session };
      if (payload.data) {
        queryClient.setQueryData(queryKeys.session, payload.data);
      }
      setSettingsMessage({ type: "success", text: "Google 로그인에 성공했습니다." });
    } catch (error) {
      setSettingsMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Google 로그인에 실패했습니다."
      });
    } finally {
      setIsGoogleUpgrading(false);
    }
  }

  function applyDayOptimistic(next: DaySnapshot): void {
    if (!sessionId) {
      return;
    }
    queryClient.setQueryData(queryKeys.day(sessionId, selectedDate), next);
  }

  function invalidateDerivedViews(): void {
    if (!sessionId) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["bootstrap", sessionId] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(sessionId, range) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reminderEval(sessionId, selectedDate) });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.bootstrap(sessionId, "dashboard", selectedDate, range),
      queryFn: () => fetchBootstrap(sessionId, "dashboard", selectedDate, range, true),
      staleTime: 0
    });
  }

  async function upsertMealCheckin(slot: MealSlot, completed: boolean, templateId?: string): Promise<void> {
    if (!sessionId) {
      setRecordsMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
      return;
    }

    const dayKey = queryKeys.day(sessionId, selectedDate);
    const previous = (queryClient.getQueryData(dayKey) as DaySnapshot | undefined) ?? dayData;
    const existing = previous.mealCheckins.find((item) => item.slot === slot && item.isDeleted !== true);
    const selectedTemplateId = completed
      ? (() => {
          if (templateId && activeMealTemplates.some((item) => item.id === templateId)) {
            return templateId;
          }
          if (existing?.templateId && activeMealTemplates.some((item) => item.id === existing.templateId)) {
            return existing.templateId;
          }
          return activeMealTemplates[0]?.id;
        })()
      : undefined;

    if (completed && !selectedTemplateId) {
      setRecordsMessage({ type: "error", text: "활성 식단 템플릿이 필요합니다." });
      return;
    }

    const optimistic: DaySnapshot = {
      ...previous,
      mealCheckins: existing
        ? previous.mealCheckins.map((item) => {
            if (item.id !== existing.id) {
              return item;
            }
            const nextItem: MealCheckin = {
              ...item,
              completed
            };
            if (selectedTemplateId) {
              nextItem.templateId = selectedTemplateId;
            } else {
              delete nextItem.templateId;
            }
            return nextItem;
          })
        : [
            {
              id: `tmp-mchk-${Date.now()}`,
              userId: session?.userId ?? "temp-user",
              date: selectedDate,
              slot,
              completed,
              ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
              createdAt: new Date().toISOString().slice(0, 10)
            },
            ...previous.mealCheckins
          ]
    };

    applyDayOptimistic(optimistic);
    setRecordsMessage({
      type: "success",
      text: `${mealSlots.find((item) => item.value === slot)?.label ?? "식단"} 체크인을 저장했습니다.`
    });

    const response = await fetch(existing ? `/api/v1/meal-checkins/${existing.id}` : "/api/v1/meal-checkins", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        date: selectedDate,
        slot,
        completed,
        ...(selectedTemplateId ? { templateId: selectedTemplateId } : {})
      })
    });

    if (!response.ok) {
      applyDayOptimistic(previous);
      setRecordsMessage({ type: "error", text: await parseErrorMessage(response, "식단 체크인 저장에 실패했습니다.") });
      return;
    }

    const payload = (await response.json()) as { data?: MealCheckin };
    if (payload.data) {
      const current = (queryClient.getQueryData(dayKey) as DaySnapshot | undefined) ?? optimistic;
      applyDayOptimistic({
        ...current,
        mealCheckins: [
          payload.data,
          ...current.mealCheckins.filter((item) => item.id !== payload.data!.id && !item.id.startsWith("tmp-mchk-"))
        ]
      });
    }

    invalidateDerivedViews();
  }

  async function deleteMealCheckin(slot: MealSlot): Promise<void> {
    if (!sessionId) {
      return;
    }

    const dayKey = queryKeys.day(sessionId, selectedDate);
    const previous = (queryClient.getQueryData(dayKey) as DaySnapshot | undefined) ?? dayData;
    const existing = previous.mealCheckins.find((item) => item.slot === slot && item.isDeleted !== true);
    if (!existing) {
      return;
    }

    applyDayOptimistic({
      ...previous,
      mealCheckins: previous.mealCheckins.filter((item) => item.id !== existing.id)
    });

    const response = await fetch(`/api/v1/meal-checkins/${existing.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    });

    if (!response.ok) {
      applyDayOptimistic(previous);
      setRecordsMessage({ type: "error", text: await parseErrorMessage(response, "식단 체크인 삭제에 실패했습니다.") });
      return;
    }

    setRecordsMessage({ type: "info", text: "식단 체크인을 삭제했습니다." });
    invalidateDerivedViews();
  }

  async function upsertWorkoutCheckin(slot: WorkoutSlot, completed: boolean, templateId?: string): Promise<void> {
    if (!sessionId) {
      setRecordsMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
      return;
    }

    const dayKey = queryKeys.day(sessionId, selectedDate);
    const previous = (queryClient.getQueryData(dayKey) as DaySnapshot | undefined) ?? dayData;
    const existing = previous.workoutLogs.find((item) => item.workoutSlot === slot && item.isDeleted !== true);
    const selectedTemplateId = completed
      ? (() => {
          if (templateId && activeWorkoutTemplates.some((item) => item.id === templateId)) {
            return templateId;
          }
          if (existing?.templateId && activeWorkoutTemplates.some((item) => item.id === existing.templateId)) {
            return existing.templateId;
          }
          return activeWorkoutTemplates[0]?.id;
        })()
      : undefined;
    if (completed && !selectedTemplateId) {
      setRecordsMessage({ type: "error", text: "활성 운동 템플릿이 필요합니다." });
      return;
    }
    const selectedTemplate = selectedTemplateId
      ? activeWorkoutTemplates.find((item) => item.id === selectedTemplateId)
      : undefined;
    const defaults = defaultWorkoutBySlot(slot);

    const nextDraft = {
      bodyPart: selectedTemplate?.bodyPart ?? existing?.bodyPart ?? defaults.bodyPart,
      purpose: selectedTemplate?.purpose ?? existing?.purpose ?? defaults.purpose,
      tool: selectedTemplate?.tool ?? existing?.tool ?? defaults.tool,
      exerciseName: selectedTemplate?.label ?? existing?.exerciseName ?? defaults.exerciseName,
      intensity: existing?.intensity ?? defaults.intensity,
      durationMinutes: selectedTemplate?.defaultDuration ?? existing?.durationMinutes ?? defaults.durationMinutes
    };

    const optimisticWorkout: WorkoutLog = {
      id: existing?.id ?? `tmp-workout-${Date.now()}`,
      userId: session?.userId ?? "temp-user",
      date: selectedDate,
      bodyPart: nextDraft.bodyPart,
      purpose: nextDraft.purpose,
      tool: nextDraft.tool,
      exerciseName: nextDraft.exerciseName,
      intensity: nextDraft.intensity,
      workoutSlot: slot,
      completed,
      ...(nextDraft.durationMinutes !== undefined ? { durationMinutes: nextDraft.durationMinutes } : {}),
      ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
      createdAt: new Date().toISOString().slice(0, 10)
    };

    applyDayOptimistic({
      ...previous,
      workoutLogs: existing
        ? previous.workoutLogs.map((item) => (item.id === existing.id ? { ...item, ...optimisticWorkout } : item))
        : [optimisticWorkout, ...previous.workoutLogs]
    });

    setRecordsMessage({
      type: "success",
      text: `${workoutSlots.find((item) => item.value === slot)?.label ?? "운동"} 체크인을 저장했습니다.`
    });

    const response = await fetch(existing ? `/api/v1/workout-checkins/${existing.id}` : "/api/v1/workout-checkins", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        date: selectedDate,
        slot,
        completed,
        ...(selectedTemplateId ? { templateId: selectedTemplateId } : {})
      })
    });

    if (!response.ok) {
      applyDayOptimistic(previous);
      setRecordsMessage({ type: "error", text: await parseErrorMessage(response, "운동 체크인 저장에 실패했습니다.") });
      return;
    }

    const payloadData = (await response.json()) as { data?: WorkoutLog };
    const saved = payloadData.data;
    if (saved) {
      const current = (queryClient.getQueryData(dayKey) as DaySnapshot | undefined) ?? previous;
      applyDayOptimistic({
        ...current,
        workoutLogs: [saved, ...current.workoutLogs.filter((item) => item.id !== saved.id && !item.id.startsWith("tmp-workout-"))]
      });
    }

    invalidateDerivedViews();
  }

  async function deleteWorkoutCheckin(slot: WorkoutSlot): Promise<void> {
    if (!sessionId) {
      return;
    }

    const dayKey = queryKeys.day(sessionId, selectedDate);
    const previous = (queryClient.getQueryData(dayKey) as DaySnapshot | undefined) ?? dayData;
    const existing = previous.workoutLogs.find((item) => item.workoutSlot === slot && item.isDeleted !== true);
    if (!existing) {
      return;
    }
    applyDayOptimistic({
      ...previous,
      workoutLogs: previous.workoutLogs.filter((item) => item.id !== existing.id)
    });

    const response = await fetch(`/api/v1/workout-checkins/${existing.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    });

    if (!response.ok) {
      applyDayOptimistic(previous);
      setRecordsMessage({ type: "error", text: await parseErrorMessage(response, "운동 체크인 삭제에 실패했습니다.") });
      return;
    }

    setRecordsMessage({ type: "info", text: "운동 체크인을 삭제했습니다." });
    invalidateDerivedViews();
  }

  async function deleteWorkoutLogById(id: string): Promise<void> {
    if (!sessionId) {
      return;
    }

    const dayKey = queryKeys.day(sessionId, selectedDate);
    const previous = (queryClient.getQueryData(dayKey) as DaySnapshot | undefined) ?? dayData;
    applyDayOptimistic({
      ...previous,
      workoutLogs: previous.workoutLogs.filter((item) => item.id !== id)
    });

    const response = await fetch(`/api/v1/workout-logs/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    });

    if (!response.ok) {
      applyDayOptimistic(previous);
      setRecordsMessage({ type: "error", text: await parseErrorMessage(response, "운동 삭제에 실패했습니다.") });
      return;
    }

    setRecordsMessage({ type: "info", text: "운동 기록을 삭제했습니다." });
    invalidateDerivedViews();
  }

  async function saveBodyMetric(): Promise<void> {
    if (!sessionId) {
      setRecordsMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
      return;
    }

    const weightKg = parseNumber(bodyMetricForm.weightKg);
    const bodyFatPct = parseNumber(bodyMetricForm.bodyFatPct);
    if (weightKg === undefined && bodyFatPct === undefined) {
      setRecordsMessage({ type: "error", text: "체중 또는 체지방 중 하나를 입력해 주세요." });
      return;
    }

    const dayKey = queryKeys.day(sessionId, selectedDate);
    const previous = (queryClient.getQueryData(dayKey) as DaySnapshot | undefined) ?? dayData;
    const optimisticMetric: BodyMetric = {
      id: `tmp-metric-${Date.now()}`,
      userId: session?.userId ?? "temp-user",
      date: bodyMetricForm.date,
      ...(weightKg !== undefined ? { weightKg } : {}),
      ...(bodyFatPct !== undefined ? { bodyFatPct } : {}),
      createdAt: new Date().toISOString().slice(0, 10)
    };

    applyDayOptimistic({
      ...previous,
      bodyMetrics: [optimisticMetric, ...previous.bodyMetrics]
    });

    const response = await fetch("/api/v1/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        date: bodyMetricForm.date,
        ...(weightKg !== undefined ? { weightKg } : {}),
        ...(bodyFatPct !== undefined ? { bodyFatPct } : {})
      })
    });

    if (!response.ok) {
      applyDayOptimistic(previous);
      setRecordsMessage({ type: "error", text: await parseErrorMessage(response, "체성분 저장에 실패했습니다.") });
      return;
    }

    const payloadData = (await response.json()) as { data?: BodyMetric };
    const saved = payloadData.data;
    if (saved) {
      const current = (queryClient.getQueryData(dayKey) as DaySnapshot | undefined) ?? previous;
      applyDayOptimistic({
        ...current,
        bodyMetrics: [saved, ...current.bodyMetrics.filter((item) => !item.id.startsWith("tmp-metric-"))]
      });
    }

    setRecordsMessage({ type: "success", text: "체성분 기록을 저장했습니다." });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(sessionId, range) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reminderEval(sessionId, selectedDate) });
  }

  async function deleteBodyMetricLog(id: string): Promise<void> {
    if (!sessionId) {
      return;
    }

    const dayKey = queryKeys.day(sessionId, selectedDate);
    const previous = (queryClient.getQueryData(dayKey) as DaySnapshot | undefined) ?? dayData;
    applyDayOptimistic({
      ...previous,
      bodyMetrics: previous.bodyMetrics.filter((item) => item.id !== id)
    });

    const response = await fetch(`/api/v1/body-metrics/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    });

    if (!response.ok) {
      applyDayOptimistic(previous);
      setRecordsMessage({ type: "error", text: await parseErrorMessage(response, "체성분 삭제에 실패했습니다.") });
      return;
    }

    setRecordsMessage({ type: "info", text: "체성분 기록을 삭제했습니다." });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(sessionId, range) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reminderEval(sessionId, selectedDate) });
  }

  async function saveGoal(): Promise<void> {
    if (!sessionId) {
      setSettingsMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
      return;
    }

    const weeklyRoutineTarget = parseNumber(goalForm.weeklyRoutineTarget);
    if (!weeklyRoutineTarget || weeklyRoutineTarget < 1 || weeklyRoutineTarget > 21) {
      setSettingsMessage({ type: "error", text: "주간 루틴 목표는 1~21 범위여야 합니다." });
      return;
    }

    const goalKey = queryKeys.goal(sessionId);
    const previous = (queryClient.getQueryData(goalKey) as Goal | null | undefined) ?? goal;
    const targetWeightKg = parseNumber(goalForm.targetWeightKg);
    const targetBodyFat = parseNumber(goalForm.targetBodyFat);
    const optimistic: Goal = {
      id: previous?.id ?? `tmp-goal-${Date.now()}`,
      userId: previous?.userId ?? session?.userId ?? "temp-user",
      weeklyRoutineTarget: Math.trunc(weeklyRoutineTarget),
      ...(goalForm.dDay.trim() ? { dDay: goalForm.dDay.trim() } : {}),
      ...(targetWeightKg !== undefined ? { targetWeightKg } : {}),
      ...(targetBodyFat !== undefined ? { targetBodyFat } : {}),
      createdAt: previous?.createdAt ?? new Date().toISOString().slice(0, 10)
    };

    queryClient.setQueryData(goalKey, optimistic);

    const response = await fetch("/api/v1/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        weeklyRoutineTarget: Math.trunc(weeklyRoutineTarget),
        ...(goalForm.dDay.trim() ? { dDay: goalForm.dDay.trim() } : {}),
        ...(targetWeightKg !== undefined ? { targetWeightKg } : {}),
        ...(targetBodyFat !== undefined ? { targetBodyFat } : {})
      })
    });

    if (!response.ok) {
      queryClient.setQueryData(goalKey, previous ?? null);
      setSettingsMessage({ type: "error", text: await parseErrorMessage(response, "목표 저장에 실패했습니다.") });
      return;
    }

    const payload = (await response.json()) as { data?: Goal };
    queryClient.setQueryData(goalKey, payload.data ?? null);
    setSettingsMessage({ type: "success", text: "목표를 저장했습니다." });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(sessionId, range) });
  }

  async function createMealTemplateAction(): Promise<void> {
    if (!sessionId) {
      setSettingsMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
      return;
    }
    if (!mealTemplateForm.label.trim()) {
      setSettingsMessage({ type: "error", text: "식단 템플릿 이름을 입력해 주세요." });
      return;
    }

    const key = queryKeys.mealTemplates(sessionId);
    const previous = (queryClient.getQueryData(key) as MealTemplate[] | undefined) ?? mealTemplates;
    const tempId = `tmp-meal-template-${Date.now()}`;
    const optimistic: MealTemplate = {
      id: tempId,
      userId: session?.userId ?? "temp-user",
      label: mealTemplateForm.label.trim(),
      isActive: true,
      createdAt: new Date().toISOString().slice(0, 10)
    };

    queryClient.setQueryData(key, [optimistic, ...previous]);

    const response = await fetch("/api/v1/templates/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        label: mealTemplateForm.label.trim(),
        isActive: true
      })
    });

    if (!response.ok) {
      queryClient.setQueryData(key, previous);
      setSettingsMessage({ type: "error", text: await parseErrorMessage(response, "식단 템플릿 저장에 실패했습니다.") });
      return;
    }

    const payload = (await response.json()) as { data?: MealTemplate };
    const saved = payload.data;
    if (saved) {
      queryClient.setQueryData(
        key,
        ((queryClient.getQueryData(key) as MealTemplate[] | undefined) ?? previous).map((item) =>
          item.id === tempId ? saved : item
        )
      );
    }

    setMealTemplateForm((prev) => ({ ...prev, label: "" }));
    setSettingsMessage({ type: "success", text: "식단 템플릿을 저장했습니다." });
  }

  async function updateMealTemplateAction(
    id: string,
    updates: Partial<Pick<MealTemplate, "label" | "isActive">>
  ): Promise<void> {
    if (!sessionId) {
      return;
    }

    const key = queryKeys.mealTemplates(sessionId);
    const previous = (queryClient.getQueryData(key) as MealTemplate[] | undefined) ?? mealTemplates;
    queryClient.setQueryData(
      key,
      previous.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );

    const response = await fetch(`/api/v1/templates/meals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        ...(updates.label !== undefined ? { label: updates.label } : {}),
        ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {})
      })
    });

    if (!response.ok) {
      queryClient.setQueryData(key, previous);
      setSettingsMessage({ type: "error", text: await parseErrorMessage(response, "식단 템플릿 수정에 실패했습니다.") });
      return;
    }

    const payload = (await response.json()) as { data?: MealTemplate };
    if (payload.data) {
      queryClient.setQueryData(
        key,
        previous.map((item) => (item.id === payload.data!.id ? payload.data! : item))
      );
    }

    setSettingsMessage({ type: "success", text: "식단 템플릿을 수정했습니다." });
  }

  async function deactivateMealTemplate(id: string): Promise<void> {
    if (!sessionId) {
      return;
    }
    await updateMealTemplateAction(id, { isActive: false });
    setSettingsMessage({ type: "info", text: "식단 템플릿을 비활성화했습니다." });
  }

  async function createWorkoutTemplateAction(): Promise<void> {
    if (!sessionId) {
      setSettingsMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
      return;
    }
    if (!workoutTemplateForm.label.trim()) {
      setSettingsMessage({ type: "error", text: "운동 템플릿 이름을 입력해 주세요." });
      return;
    }

    const defaultDuration = parseNumber(workoutTemplateForm.defaultDuration);
    const key = queryKeys.workoutTemplates(sessionId);
    const previous = (queryClient.getQueryData(key) as WorkoutTemplate[] | undefined) ?? workoutTemplates;
    const tempId = `tmp-workout-template-${Date.now()}`;
    const optimistic: WorkoutTemplate = {
      id: tempId,
      userId: session?.userId ?? "temp-user",
      label: workoutTemplateForm.label.trim(),
      bodyPart: workoutTemplateForm.bodyPart,
      purpose: workoutTemplateForm.purpose,
      tool: workoutTemplateForm.tool,
      ...(defaultDuration !== undefined ? { defaultDuration: Math.trunc(defaultDuration) } : {}),
      isActive: true,
      createdAt: new Date().toISOString().slice(0, 10)
    };

    queryClient.setQueryData(key, [optimistic, ...previous]);

    const response = await fetch("/api/v1/templates/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        label: workoutTemplateForm.label.trim(),
        bodyPart: workoutTemplateForm.bodyPart,
        purpose: workoutTemplateForm.purpose,
        tool: workoutTemplateForm.tool,
        ...(defaultDuration !== undefined ? { defaultDuration: Math.trunc(defaultDuration) } : {}),
        isActive: true
      })
    });

    if (!response.ok) {
      queryClient.setQueryData(key, previous);
      setSettingsMessage({ type: "error", text: await parseErrorMessage(response, "운동 템플릿 저장에 실패했습니다.") });
      return;
    }

    const payload = (await response.json()) as { data?: WorkoutTemplate };
    const saved = payload.data;
    if (saved) {
      queryClient.setQueryData(
        key,
        ((queryClient.getQueryData(key) as WorkoutTemplate[] | undefined) ?? previous).map((item) =>
          item.id === tempId ? saved : item
        )
      );
    }

    setWorkoutTemplateForm((prev) => ({ ...prev, label: "" }));
    setSettingsMessage({ type: "success", text: "운동 템플릿을 저장했습니다." });
  }

  async function updateWorkoutTemplateAction(
    id: string,
    updates: Partial<
      Pick<WorkoutTemplate, "label" | "bodyPart" | "purpose" | "tool" | "defaultDuration" | "isActive">
    >
  ): Promise<void> {
    if (!sessionId) {
      return;
    }

    const key = queryKeys.workoutTemplates(sessionId);
    const previous = (queryClient.getQueryData(key) as WorkoutTemplate[] | undefined) ?? workoutTemplates;

    queryClient.setQueryData(
      key,
      previous.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );

    const response = await fetch(`/api/v1/templates/workouts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        ...(updates.label !== undefined ? { label: updates.label } : {}),
        ...(updates.bodyPart !== undefined ? { bodyPart: updates.bodyPart } : {}),
        ...(updates.purpose !== undefined ? { purpose: updates.purpose } : {}),
        ...(updates.tool !== undefined ? { tool: updates.tool } : {}),
        ...(updates.defaultDuration !== undefined ? { defaultDuration: updates.defaultDuration } : {}),
        ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {})
      })
    });

    if (!response.ok) {
      queryClient.setQueryData(key, previous);
      setSettingsMessage({ type: "error", text: await parseErrorMessage(response, "운동 템플릿 수정에 실패했습니다.") });
      return;
    }

    const payload = (await response.json()) as { data?: WorkoutTemplate };
    if (payload.data) {
      queryClient.setQueryData(
        key,
        previous.map((item) => (item.id === payload.data!.id ? payload.data! : item))
      );
    }

    setSettingsMessage({ type: "success", text: "운동 템플릿을 수정했습니다." });
  }

  async function deactivateWorkoutTemplate(id: string): Promise<void> {
    if (!sessionId) {
      return;
    }
    await updateWorkoutTemplateAction(id, { isActive: false });
    setSettingsMessage({ type: "info", text: "운동 템플릿을 비활성화했습니다." });
  }

  function startMealTemplateEdit(item: MealTemplate): void {
    setEditingMealTemplateId(item.id);
    setEditingMealTemplateDraft({
      label: item.label
    });
  }

  async function saveMealTemplateEdit(): Promise<void> {
    if (!editingMealTemplateId) {
      return;
    }
    if (!editingMealTemplateDraft.label.trim()) {
      setSettingsMessage({ type: "error", text: "식단 템플릿 이름을 입력해 주세요." });
      return;
    }
    await updateMealTemplateAction(editingMealTemplateId, {
      label: editingMealTemplateDraft.label.trim()
    });
    setEditingMealTemplateId(null);
  }

  function startWorkoutTemplateEdit(item: WorkoutTemplate): void {
    setEditingWorkoutTemplateId(item.id);
    setEditingWorkoutTemplateDraft({
      label: item.label,
      bodyPart: item.bodyPart,
      purpose: item.purpose,
      tool: item.tool,
      defaultDuration: String(item.defaultDuration ?? 30)
    });
  }

  async function saveWorkoutTemplateEdit(): Promise<void> {
    if (!editingWorkoutTemplateId) {
      return;
    }
    if (!editingWorkoutTemplateDraft.label.trim()) {
      setSettingsMessage({ type: "error", text: "운동 템플릿 이름을 입력해 주세요." });
      return;
    }

    await updateWorkoutTemplateAction(editingWorkoutTemplateId, {
      label: editingWorkoutTemplateDraft.label.trim(),
      bodyPart: editingWorkoutTemplateDraft.bodyPart,
      purpose: editingWorkoutTemplateDraft.purpose,
      tool: editingWorkoutTemplateDraft.tool,
      ...(parseNumber(editingWorkoutTemplateDraft.defaultDuration) !== undefined
        ? { defaultDuration: Math.trunc(parseNumber(editingWorkoutTemplateDraft.defaultDuration) ?? 30) }
        : {})
    });
    setEditingWorkoutTemplateId(null);
  }

  const isRecordsLoading = view === "records" && dayQuery.isPending && !dayQuery.data;

  return (
    <>
      <section className="compact-header card">
        <div>
          <p className="header-eyebrow">ROUTINEMATE</p>
          <h1 className="header-title">오늘의 루틴을 빠르게 기록하고 복기하세요.</h1>
          <p className="header-sub">식단 체크인, 운동, 체성분, 목표를 페이지별로 분리해 관리합니다.</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="button button-primary"
            disabled={isGoogleUpgrading}
            onClick={() => void upgradeWithGoogle()}
          >
            {isGoogleUpgrading
              ? "Google 인증 중..."
              : session?.authProvider === "google"
                ? "Google 재인증"
                : "Google 로그인"}
          </button>
          <p className="session-badge">
            {session?.authProvider === "google" ? `Google 연결됨 (${session.email ?? "이메일 없음"})` : "로그인 필요"}
          </p>
          <p className="session-badge">{isSyncing ? "동기화 중..." : "동기화 완료"}</p>
        </div>
        {sessionMessage ? (
          <p className={`status status-${sessionMessage.type}`} aria-live="polite">
            {sessionMessage.text}
          </p>
        ) : null}
      </section>

      {view === "dashboard" ? (
        <section className="card">
          <div className="section-head">
            <h2>대시보드</h2>
            <div className="range-toggle" role="group" aria-label="Dashboard range">
              {ranges.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={range === item ? "active" : ""}
                  onClick={() => setRange(item)}
                  disabled={!session}
                >
                  {rangeLabels[item]}
                </button>
              ))}
            </div>
          </div>

          {dashboardMessage ? (
            <p className={`status status-${dashboardMessage.type}`} aria-live="polite">
              {dashboardMessage.text}
            </p>
          ) : null}

          <div className="kpi-grid">
            <article className="kpi-card">
              <h3>체크인율</h3>
              <p>{dashboard ? formatPercent(dashboard.adherenceRate) : "--"}</p>
            </article>
            <article className="kpi-card">
              <h3>식단 로그</h3>
              <p>{dashboard ? `${dashboard.totalMeals}건` : "--"}</p>
            </article>
            <article className="kpi-card">
              <h3>운동 로그</h3>
              <p>{dashboard ? `${dashboard.totalWorkouts}건` : "--"}</p>
            </article>
            <article className="kpi-card">
              <h3>목표 달성률</h3>
              <p>{dashboard?.goals[0] ? formatPercent(dashboard.goals[0].goalAchievementRate) : "--"}</p>
            </article>
          </div>

          <div className="trend-panel">
            <h3>점수 추세 ({dashboard?.granularity ?? "day"} 기준)</h3>
            {!dashboard && bootstrapQuery.isPending ? (
              <p className="hint">대시보드를 불러오는 중입니다.</p>
            ) : !dashboard || dashboard.buckets.length === 0 ? (
              <p className="hint">기록이 쌓이면 추세 버킷을 표시합니다.</p>
            ) : (
              <div className="trend-list">
                {dashboard.buckets.map((bucket) => (
                  <div key={bucket.key} className="trend-row trend-row-wide">
                    <span className="trend-date-wide">{formatBucketLabel(bucket, dashboard.granularity)}</span>
                    <div className="trend-track" aria-hidden="true">
                      <span className="trend-fill" style={{ width: `${bucket.avgOverallScore}%` }} />
                    </div>
                    <span className="trend-score">{bucket.avgOverallScore}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="metric-trend-panel">
            <h3>체성분 추세 (전체 기록)</h3>
            <div className="metric-trend-grid">
              <MetricTrendChart title="체중" unit="kg" colorClassName="metric-line-weight" points={weightTrendPoints} />
              <MetricTrendChart
                title="체지방"
                unit="%"
                colorClassName="metric-line-bodyfat"
                points={bodyFatTrendPoints}
              />
            </div>
          </div>

          <div className="goal-summary">
            <strong>현재 목표:</strong> {currentGoalLabel}
            {dashboard?.goals[0] ? (
              <div className="goal-inline-grid">
                <span>{formatDday(dashboard.goals[0].daysToDday)}</span>
                <span>루틴 {formatPercent(dashboard.goals[0].routineCompletionRate)}</span>
                <span>체중 {formatPercent(dashboard.goals[0].weightAchievementRate)}</span>
                <span>체지방 {formatPercent(dashboard.goals[0].bodyFatAchievementRate)}</span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {view === "records" ? (
        <>
          <section className="card">
            <h2>기록 날짜</h2>
            <div className="form-grid">
              <DateField label="날짜" value={selectedDate} onChange={setSelectedDate} />
            </div>
            {recordsMessage ? (
              <p className={`status status-${recordsMessage.type}`} aria-live="polite">
                {recordsMessage.text}
              </p>
            ) : null}
            {reminderSettings?.isEnabled && reminderEvaluation?.isMissingLogCandidate ? (
              <p className="status status-info" aria-live="polite">
                미기록 상태입니다. 오늘 기록을 1건만 추가해도 경고가 해제됩니다.
              </p>
            ) : null}
          </section>

          <section className="card">
            <h2>식단 체크인</h2>
            <p className="hint">아침/점심/저녁/저녁2 슬롯에서 함/안함만 기록합니다. 활성 식단 템플릿은 전 슬롯 공통으로 표시됩니다.</p>

            {isRecordsLoading ? (
              <p className="hint">선택 날짜의 기록을 불러오는 중입니다.</p>
            ) : (
              <div className="slot-grid">
                {mealSlots.map((slot) => {
                  const current = checkinBySlot.get(slot.value);
                  return (
                    <article key={slot.value} className="slot-card">
                      <div className="slot-head">
                        <h3>{slot.label}</h3>
                        {current ? <span className="slot-state">{current.completed ? "함" : "안함"}</span> : <span className="slot-state">미기록</span>}
                      </div>
                      <div className="slot-actions">
                        <button
                          type="button"
                          className="button button-primary"
                          onClick={() => void upsertMealCheckin(slot.value, true)}
                          disabled={activeMealTemplates.length === 0}
                        >
                          함
                        </button>
                        <button type="button" className="button" onClick={() => void upsertMealCheckin(slot.value, false)}>
                          안함
                        </button>
                        {current ? (
                          <button type="button" className="button" onClick={() => void deleteMealCheckin(slot.value)}>
                            삭제
                          </button>
                        ) : null}
                      </div>
                      {activeMealTemplates.length > 0 ? (
                        <div className="chip-row">
                          {activeMealTemplates.map((template) => (
                            <button
                              key={template.id}
                              type="button"
                              className={current?.templateId === template.id ? "recommend-chip is-selected" : "recommend-chip"}
                              onClick={() => void upsertMealCheckin(slot.value, true, template.id)}
                            >
                              {template.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="hint">설정 페이지에서 식단 템플릿을 1개 이상 등록하면 1탭 선택이 가능합니다.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card">
            <h2>운동 체크인</h2>
            <p className="hint">오전/오후 슬롯에서 함/안함만 기록합니다. 함 선택은 활성 운동 템플릿이 있을 때만 가능합니다.</p>
            <div className="slot-grid">
              {workoutSlots.map((slot) => {
                const current = workoutCheckinBySlot.get(slot.value);
                return (
                  <article key={slot.value} className="slot-card">
                    <div className="slot-head">
                      <h3>{slot.label}</h3>
                      {current ? (
                        <span className="slot-state">{current.completed ? "함" : "안함"}</span>
                      ) : (
                        <span className="slot-state">미기록</span>
                      )}
                    </div>
                    <div className="slot-actions">
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => void upsertWorkoutCheckin(slot.value, true)}
                        disabled={activeWorkoutTemplates.length === 0}
                      >
                        함
                      </button>
                      <button type="button" className="button" onClick={() => void upsertWorkoutCheckin(slot.value, false)}>
                        안함
                      </button>
                      {current ? (
                        <button type="button" className="button" onClick={() => void deleteWorkoutCheckin(slot.value)}>
                          삭제
                        </button>
                      ) : null}
                    </div>
                    {activeWorkoutTemplates.length > 0 ? (
                      <div className="chip-row">
                        {activeWorkoutTemplates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            className={current?.templateId === template.id ? "recommend-chip is-selected" : "recommend-chip"}
                            onClick={() => void upsertWorkoutCheckin(slot.value, true, template.id)}
                          >
                            {template.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="hint">설정 페이지에서 운동 템플릿을 추가하면 1탭 선택이 가능합니다.</p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="card">
            <h2>체중/체지방 기록</h2>
            <div className="form-grid">
              <DateField
                label="날짜"
                value={bodyMetricForm.date}
                onChange={(value) => setBodyMetricForm((prev) => ({ ...prev, date: value }))}
              />
              <SelectField
                label="체중(kg)"
                value={bodyMetricForm.weightKg}
                options={weightOptions}
                suffix="kg"
                onChange={(value) => setBodyMetricForm((prev) => ({ ...prev, weightKg: value }))}
              />
              <SelectField
                label="체지방(%)"
                value={bodyMetricForm.bodyFatPct}
                options={bodyFatOptions}
                suffix="%"
                onChange={(value) => setBodyMetricForm((prev) => ({ ...prev, bodyFatPct: value }))}
              />
            </div>
            <button
              type="button"
              className="button button-primary full-width action-gap-lg"
              onClick={() => void saveBodyMetric()}
            >
              체성분 저장
            </button>
          </section>

          <section className="card split-grid">
            <article>
              <h2>운동 기록 목록</h2>
              <div className="record-list">
                {dayData.workoutLogs.length === 0 ? (
                  <p className="hint">선택한 날짜의 운동 기록이 없습니다.</p>
                ) : (
                  dayData.workoutLogs.map((item) => (
                    <div key={item.id} className="record-item">
                      <div>
                        <strong>
                          {item.workoutSlot
                            ? `${workoutSlots.find((slot) => slot.value === item.workoutSlot)?.label ?? item.workoutSlot} ${
                                item.completed === false ? "안함" : "함"
                              }`
                            : item.exerciseName}
                        </strong>
                        <p className="hint">
                          {item.exerciseName} / {item.bodyPart} / {item.purpose} / {item.tool} / {item.durationMinutes ?? 30}분
                        </p>
                      </div>
                      <button type="button" className="button" onClick={() => void deleteWorkoutLogById(item.id)}>
                        삭제
                      </button>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article>
              <h2>체성분 기록 목록</h2>
              <div className="record-list">
                {dayData.bodyMetrics.length === 0 ? (
                  <p className="hint">선택한 날짜의 체성분 기록이 없습니다.</p>
                ) : (
                  dayData.bodyMetrics.map((item) => (
                    <div key={item.id} className="record-item">
                      <div>
                        <strong>{item.date}</strong>
                        <p className="hint">
                          체중 {item.weightKg ?? "--"}kg / 체지방 {item.bodyFatPct ?? "--"}%
                        </p>
                      </div>
                      <button type="button" className="button" onClick={() => void deleteBodyMetricLog(item.id)}>
                        삭제
                      </button>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}

      {view === "settings" ? (
        <div className="settings-stack">
          <section className="card settings-goal-card">
            <article>
              <h2>목표 설정</h2>
              <p className="hint">목표는 설정 페이지에서만 관리하고, 대시보드에서는 읽기 전용으로 표시합니다.</p>
              {settingsMessage ? (
                <p className={`status status-${settingsMessage.type}`} aria-live="polite">
                  {settingsMessage.text}
                </p>
              ) : null}
              <div className="form-grid">
                <SelectField
                  label="주간 루틴 목표(회)"
                  value={goalForm.weeklyRoutineTarget}
                  options={weeklyTargetOptions}
                  suffix="회"
                  allowEmpty={false}
                  onChange={(value) => setGoalForm((prev) => ({ ...prev, weeklyRoutineTarget: value }))}
                />
                <DateField
                  label="D-day"
                  value={goalForm.dDay}
                  onChange={(value) => setGoalForm((prev) => ({ ...prev, dDay: value }))}
                />
                <SelectField
                  label="목표 체중(kg)"
                  value={goalForm.targetWeightKg}
                  options={weightOptions}
                  suffix="kg"
                  onChange={(value) => setGoalForm((prev) => ({ ...prev, targetWeightKg: value }))}
                />
                <SelectField
                  label="목표 체지방(%)"
                  value={goalForm.targetBodyFat}
                  options={bodyFatOptions}
                  suffix="%"
                  onChange={(value) => setGoalForm((prev) => ({ ...prev, targetBodyFat: value }))}
                />
              </div>
              <button type="button" className="button button-primary full-width settings-submit" onClick={() => void saveGoal()}>
                목표 저장
              </button>
            </article>
          </section>

          <section className="card split-grid settings-template-grid">
            <article>
              <h2>Google 로그인</h2>
              <p className="hint">Google 로그인 1회 후 웹/모바일에서 동일 계정 데이터로 동기화됩니다.</p>
              <button
                type="button"
                className="button button-primary full-width settings-submit"
                disabled={isGoogleUpgrading}
                onClick={() => void upgradeWithGoogle()}
              >
                {isGoogleUpgrading
                  ? "Google 인증 중..."
                  : session?.authProvider === "google"
                    ? "Google 재로그인"
                    : "Google 로그인"}
              </button>
              <p className="hint">
                현재 상태:{" "}
                {session?.authProvider === "google"
                  ? `Google 연결됨 (${session.email ?? "이메일 없음"})`
                  : "Google 로그인 필요"}
              </p>
            </article>

            <article>
              <h2>리마인더 설정</h2>
              <p className="hint">고정 알림 + 미기록 감지 알림을 함께 사용합니다.</p>
              <div className="form-grid">
                <label className="field full-span">
                  <span>활성화</span>
                  <select
                    value={reminderForm.isEnabled ? "on" : "off"}
                    onChange={(event) => setReminderForm((prev) => ({ ...prev, isEnabled: event.target.value === "on" }))}
                  >
                    <option value="on">사용</option>
                    <option value="off">미사용</option>
                  </select>
                </label>
                <label className="field">
                  <span>일일 알림 시간</span>
                  <input
                    type="time"
                    value={reminderForm.dailyReminderTime}
                    onChange={(event) =>
                      setReminderForm((prev) => ({ ...prev, dailyReminderTime: event.target.value || "20:00" }))
                    }
                  />
                </label>
                <label className="field">
                  <span>미기록 감지 시간</span>
                  <input
                    type="time"
                    value={reminderForm.missingLogReminderTime}
                    onChange={(event) =>
                      setReminderForm((prev) => ({ ...prev, missingLogReminderTime: event.target.value || "21:30" }))
                    }
                  />
                </label>
                <label className="field full-span">
                  <span>타임존</span>
                  <input
                    type="text"
                    value={reminderForm.timezone}
                    onChange={(event) => setReminderForm((prev) => ({ ...prev, timezone: event.target.value }))}
                    placeholder="Asia/Seoul"
                  />
                </label>
              </div>
              <div className="chip-row reminder-channel-row">
                <button
                  type="button"
                  className={reminderForm.channels.includes("web_in_app") ? "recommend-chip is-selected" : "recommend-chip"}
                  onClick={() => toggleReminderChannel("web_in_app")}
                >
                  인앱
                </button>
                <button
                  type="button"
                  className={reminderForm.channels.includes("web_push") ? "recommend-chip is-selected" : "recommend-chip"}
                  onClick={() => toggleReminderChannel("web_push")}
                >
                  브라우저 푸시
                </button>
                <button
                  type="button"
                  className={reminderForm.channels.includes("mobile_local") ? "recommend-chip is-selected" : "recommend-chip"}
                  onClick={() => toggleReminderChannel("mobile_local")}
                >
                  모바일 로컬
                </button>
              </div>
              <button
                type="button"
                className="button button-primary full-width settings-submit"
                onClick={() => void saveReminderSettingsAction()}
              >
                리마인더 저장
              </button>
            </article>
          </section>

          <section className="card split-grid settings-template-grid">
            <article>
              <h2>식단 템플릿</h2>
              <div className="form-grid">
                <label className="field full-span">
                  <span>템플릿명</span>
                  <input
                    type="text"
                    value={mealTemplateForm.label}
                    onChange={(event) => setMealTemplateForm((prev) => ({ ...prev, label: event.target.value }))}
                  />
                </label>
              </div>
              <button type="button" className="button button-primary full-width settings-submit" onClick={() => void createMealTemplateAction()}>
                식단 템플릿 추가
              </button>
              <div className="record-list">
                {mealTemplatesQuery.isPending && mealTemplates.length === 0 ? (
                  <p className="hint">식단 템플릿을 불러오는 중입니다.</p>
                ) : mealTemplates.length === 0 ? (
                  <p className="hint">등록된 식단 템플릿이 없습니다.</p>
                ) : (
                  mealTemplates.map((item) => (
                    <div key={item.id} className="record-item record-item-inline">
                      {editingMealTemplateId === item.id ? (
                        <>
                          <div className="inline-edit-grid">
                            <label className="field">
                              <span>템플릿명</span>
                              <input
                                type="text"
                                value={editingMealTemplateDraft.label}
                                onChange={(event) =>
                                  setEditingMealTemplateDraft((prev) => ({ ...prev, label: event.target.value }))
                                }
                              />
                            </label>
                          </div>
                          <div className="record-actions">
                            <button type="button" className="button button-primary" onClick={() => void saveMealTemplateEdit()}>
                              저장
                            </button>
                            <button type="button" className="button" onClick={() => setEditingMealTemplateId(null)}>
                              취소
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <strong>{item.label}</strong>
                            <p className="hint">{item.isActive ? "활성" : "비활성"}</p>
                          </div>
                          <div className="record-actions">
                            {item.isActive ? (
                              <button type="button" className="button" onClick={() => startMealTemplateEdit(item)}>
                                수정
                              </button>
                            ) : null}
                            {item.isActive ? (
                              <button type="button" className="button" onClick={() => void deactivateMealTemplate(item.id)}>
                                비활성화
                              </button>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </article>

            <article>
              <h2>운동 템플릿</h2>
              <div className="form-grid">
                <label className="field">
                  <span>템플릿명</span>
                  <input
                    type="text"
                    value={workoutTemplateForm.label}
                    onChange={(event) => setWorkoutTemplateForm((prev) => ({ ...prev, label: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>기본 시간(분)</span>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={workoutTemplateForm.defaultDuration}
                    onChange={(event) => setWorkoutTemplateForm((prev) => ({ ...prev, defaultDuration: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>부위</span>
                  <select
                    value={workoutTemplateForm.bodyPart}
                    onChange={(event) =>
                      setWorkoutTemplateForm((prev) => ({ ...prev, bodyPart: event.target.value as BodyPart }))
                    }
                  >
                    {bodyPartOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>목적</span>
                  <select
                    value={workoutTemplateForm.purpose}
                    onChange={(event) =>
                      setWorkoutTemplateForm((prev) => ({ ...prev, purpose: event.target.value as WorkoutPurpose }))
                    }
                  >
                    {purposeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field full-span">
                  <span>도구</span>
                  <select
                    value={workoutTemplateForm.tool}
                    onChange={(event) => setWorkoutTemplateForm((prev) => ({ ...prev, tool: event.target.value as WorkoutTool }))}
                  >
                    {toolOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="button" className="button button-primary full-width settings-submit" onClick={() => void createWorkoutTemplateAction()}>
                운동 템플릿 추가
              </button>
              <div className="record-list">
                {workoutTemplatesQuery.isPending && workoutTemplates.length === 0 ? (
                  <p className="hint">운동 템플릿을 불러오는 중입니다.</p>
                ) : workoutTemplates.length === 0 ? (
                  <p className="hint">등록된 운동 템플릿이 없습니다.</p>
                ) : (
                  workoutTemplates.map((item) => (
                    <div key={item.id} className="record-item record-item-inline">
                      {editingWorkoutTemplateId === item.id ? (
                        <>
                          <div className="inline-edit-grid workout-inline-edit-grid">
                            <label className="field">
                              <span>템플릿명</span>
                              <input
                                type="text"
                                value={editingWorkoutTemplateDraft.label}
                                onChange={(event) =>
                                  setEditingWorkoutTemplateDraft((prev) => ({ ...prev, label: event.target.value }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>기본 시간(분)</span>
                              <input
                                type="number"
                                min={1}
                                max={300}
                                value={editingWorkoutTemplateDraft.defaultDuration}
                                onChange={(event) =>
                                  setEditingWorkoutTemplateDraft((prev) => ({ ...prev, defaultDuration: event.target.value }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>부위</span>
                              <select
                                value={editingWorkoutTemplateDraft.bodyPart}
                                onChange={(event) =>
                                  setEditingWorkoutTemplateDraft((prev) => ({ ...prev, bodyPart: event.target.value as BodyPart }))
                                }
                              >
                                {bodyPartOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              <span>목적</span>
                              <select
                                value={editingWorkoutTemplateDraft.purpose}
                                onChange={(event) =>
                                  setEditingWorkoutTemplateDraft((prev) => ({ ...prev, purpose: event.target.value as WorkoutPurpose }))
                                }
                              >
                                {purposeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field full-span">
                              <span>도구</span>
                              <select
                                value={editingWorkoutTemplateDraft.tool}
                                onChange={(event) =>
                                  setEditingWorkoutTemplateDraft((prev) => ({ ...prev, tool: event.target.value as WorkoutTool }))
                                }
                              >
                                {toolOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="record-actions">
                            <button type="button" className="button button-primary" onClick={() => void saveWorkoutTemplateEdit()}>
                              저장
                            </button>
                            <button type="button" className="button" onClick={() => setEditingWorkoutTemplateId(null)}>
                              취소
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <strong>{item.label}</strong>
                            <p className="hint">
                              {item.bodyPart} / {item.purpose} / {item.tool} / {item.defaultDuration ?? 30}분 /{" "}
                              {item.isActive ? "활성" : "비활성"}
                            </p>
                          </div>
                          <div className="record-actions">
                            {item.isActive ? (
                              <button type="button" className="button" onClick={() => startWorkoutTemplateEdit(item)}>
                                수정
                              </button>
                            ) : null}
                            {item.isActive ? (
                              <button type="button" className="button" onClick={() => void deactivateWorkoutTemplate(item.id)}>
                                비활성화
                              </button>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </div>
      ) : null}
    </>
  );
}
