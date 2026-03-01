"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BodyMetric,
  BodyPart,
  DashboardBucket,
  DashboardSummary,
  Goal,
  MealCheckin,
  MealSlot,
  MealTemplate,
  RangeKey,
  WorkoutIntensity,
  WorkoutLog,
  WorkoutPurpose,
  WorkoutTemplate,
  WorkoutTool
} from "@routinemate/domain";

export type WorkspaceView = "dashboard" | "records" | "settings";

type MessageType = "error" | "success" | "info";
type Message = { type: MessageType; text: string };

type SessionPayload = { sessionId: string; userId: string };

type DayPayload = {
  date: string;
  mealCheckins: MealCheckin[];
  workoutLogs: WorkoutLog[];
  bodyMetrics: BodyMetric[];
};

type GoalForm = {
  weeklyRoutineTarget: string;
  dDay: string;
  targetWeightKg: string;
  targetBodyFat: string;
};

type WorkoutForm = {
  date: string;
  bodyPart: BodyPart;
  purpose: WorkoutPurpose;
  tool: WorkoutTool;
  exerciseName: string;
  intensity: WorkoutIntensity;
  durationMinutes: string;
  templateId: string;
};

type BodyMetricForm = {
  date: string;
  weightKg: string;
  bodyFatPct: string;
};

const ranges: RangeKey[] = ["7d", "30d", "90d"];

const mealSlots: Array<{ value: MealSlot; label: string }> = [
  { value: "breakfast", label: "아침" },
  { value: "lunch", label: "점심" },
  { value: "dinner", label: "저녁" },
  { value: "dinner2", label: "저녁2" }
];

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

const intensityOptions: Array<{ value: WorkoutIntensity; label: string }> = [
  { value: "low", label: "낮음" },
  { value: "medium", label: "보통" },
  { value: "high", label: "높음" }
];

function todayYmd(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

export function RoutineWorkspace({ view }: { view: WorkspaceView }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [range, setRange] = useState<RangeKey>("7d");
  const [selectedDate, setSelectedDate] = useState<string>(todayYmd());

  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [dayData, setDayData] = useState<DayPayload>({ date: todayYmd(), mealCheckins: [], workoutLogs: [], bodyMetrics: [] });
  const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>([]);
  const [workoutTemplates, setWorkoutTemplates] = useState<WorkoutTemplate[]>([]);

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

  const [workoutForm, setWorkoutForm] = useState<WorkoutForm>({
    date: todayYmd(),
    bodyPart: "full_body",
    purpose: "fat_loss",
    tool: "bodyweight",
    exerciseName: "",
    intensity: "medium",
    durationMinutes: "30",
    templateId: ""
  });

  const [bodyMetricForm, setBodyMetricForm] = useState<BodyMetricForm>({
    date: todayYmd(),
    weightKg: "",
    bodyFatPct: ""
  });

  const [mealTemplateForm, setMealTemplateForm] = useState<{ label: string; mealSlot: MealSlot }>({
    label: "",
    mealSlot: "lunch"
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

  async function fetchDashboard(sessionId: string, currentRange: RangeKey): Promise<void> {
    const response = await fetch(
      `/api/v1/dashboard?sessionId=${encodeURIComponent(sessionId)}&range=${encodeURIComponent(currentRange)}`
    );
    if (!response.ok) {
      const message = await parseErrorMessage(response, "대시보드 조회에 실패했습니다.");
      setDashboardMessage({ type: "error", text: message });
      return;
    }
    const payload = (await response.json()) as { data?: DashboardSummary };
    setDashboard(payload.data ?? null);
    setDashboardMessage(null);
  }

  async function fetchGoal(sessionId: string): Promise<void> {
    const response = await fetch(`/api/v1/goals?sessionId=${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { data?: { goal?: Goal | null } };
    const current = payload.data?.goal ?? null;
    setGoal(current);
    if (current) {
      setGoalForm({
        weeklyRoutineTarget: String(current.weeklyRoutineTarget),
        dDay: current.dDay ?? "",
        targetWeightKg: current.targetWeightKg?.toString() ?? "",
        targetBodyFat: current.targetBodyFat?.toString() ?? ""
      });
    }
  }

  async function fetchDay(sessionId: string, date: string): Promise<void> {
    const response = await fetch(
      `/api/v1/calendar/day?sessionId=${encodeURIComponent(sessionId)}&date=${encodeURIComponent(date)}`
    );
    if (!response.ok) {
      const message = await parseErrorMessage(response, "기록 조회에 실패했습니다.");
      setRecordsMessage({ type: "error", text: message });
      return;
    }
    const payload = (await response.json()) as { data?: DayPayload };
    setDayData(
      payload.data ?? {
        date,
        mealCheckins: [],
        workoutLogs: [],
        bodyMetrics: []
      }
    );
  }

  async function fetchTemplates(sessionId: string): Promise<void> {
    const [mealResponse, workoutResponse] = await Promise.all([
      fetch(`/api/v1/templates/meals?sessionId=${encodeURIComponent(sessionId)}`),
      fetch(`/api/v1/templates/workouts?sessionId=${encodeURIComponent(sessionId)}`)
    ]);

    if (mealResponse.ok) {
      const payload = (await mealResponse.json()) as { data?: { templates?: MealTemplate[] } };
      setMealTemplates(payload.data?.templates ?? []);
    }
    if (workoutResponse.ok) {
      const payload = (await workoutResponse.json()) as { data?: { templates?: WorkoutTemplate[] } };
      setWorkoutTemplates(payload.data?.templates ?? []);
    }
  }

  async function bootstrap(sessionId: string): Promise<void> {
    await Promise.all([
      fetchDashboard(sessionId, range),
      fetchGoal(sessionId),
      fetchDay(sessionId, selectedDate),
      fetchTemplates(sessionId)
    ]);
  }

  async function restoreSession(): Promise<void> {
    const response = await fetch("/api/v1/auth/guest");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { data?: SessionPayload };
    if (!payload.data) {
      return;
    }
    setSession(payload.data);
    await bootstrap(payload.data.sessionId);
  }

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    void fetchDashboard(session.sessionId, range);
  }, [range, session?.sessionId]);

  useEffect(() => {
    if (!session) {
      return;
    }
    void fetchDay(session.sessionId, selectedDate);
  }, [session?.sessionId, selectedDate]);

  async function createGuestSession(): Promise<void> {
    const response = await fetch("/api/v1/auth/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    if (!response.ok) {
      const message = await parseErrorMessage(response, "게스트 세션 생성에 실패했습니다.");
      setSessionMessage({ type: "error", text: message });
      return;
    }
    const payload = (await response.json()) as { data?: SessionPayload };
    if (!payload.data) {
      setSessionMessage({ type: "error", text: "세션 응답이 비정상입니다." });
      return;
    }
    setSession(payload.data);
    setSessionMessage({ type: "success", text: "게스트 세션이 시작되었습니다." });
    await bootstrap(payload.data.sessionId);
  }

  async function upsertMealCheckin(slot: MealSlot, completed: boolean, templateId?: string): Promise<void> {
    if (!session) {
      setRecordsMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    const existing = checkinBySlot.get(slot);
    const response = await fetch(existing ? `/api/v1/meal-checkins/${existing.id}` : "/api/v1/meal-checkins", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: selectedDate,
        slot,
        completed,
        ...(templateId ? { templateId } : {})
      })
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response, "식단 체크인 저장에 실패했습니다.");
      setRecordsMessage({ type: "error", text: message });
      return;
    }

    setRecordsMessage({ type: "success", text: `${mealSlots.find((item) => item.value === slot)?.label ?? "식단"} 체크인을 저장했습니다.` });
    await Promise.all([fetchDay(session.sessionId, selectedDate), fetchDashboard(session.sessionId, range)]);
  }

  async function deleteMealCheckin(slot: MealSlot): Promise<void> {
    if (!session) {
      return;
    }
    const existing = checkinBySlot.get(slot);
    if (!existing) {
      return;
    }

    const response = await fetch(`/api/v1/meal-checkins/${existing.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId })
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response, "식단 체크인 삭제에 실패했습니다.");
      setRecordsMessage({ type: "error", text: message });
      return;
    }

    setRecordsMessage({ type: "info", text: "식단 체크인을 삭제했습니다." });
    await Promise.all([fetchDay(session.sessionId, selectedDate), fetchDashboard(session.sessionId, range)]);
  }

  async function saveWorkoutLog(payload?: WorkoutTemplate): Promise<void> {
    if (!session) {
      setRecordsMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }

    const source = payload
      ? {
          date: selectedDate,
          bodyPart: payload.bodyPart,
          purpose: payload.purpose,
          tool: payload.tool,
          exerciseName: payload.label,
          intensity: "medium" as WorkoutIntensity,
          durationMinutes: payload.defaultDuration ?? 30,
          templateId: payload.id
        }
      : {
          date: workoutForm.date,
          bodyPart: workoutForm.bodyPart,
          purpose: workoutForm.purpose,
          tool: workoutForm.tool,
          exerciseName: workoutForm.exerciseName.trim() || "기본 운동",
          intensity: workoutForm.intensity,
          durationMinutes: Math.trunc(parseNumber(workoutForm.durationMinutes) ?? 30),
          templateId: workoutForm.templateId || undefined
        };

    const response = await fetch("/api/v1/workout-logs/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        ...source,
        ...(source.templateId ? { templateId: source.templateId } : {})
      })
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response, "운동 저장에 실패했습니다.");
      setRecordsMessage({ type: "error", text: message });
      return;
    }

    setWorkoutForm((prev) => ({ ...prev, exerciseName: "" }));
    setRecordsMessage({ type: "success", text: "운동을 저장했습니다." });
    await Promise.all([fetchDay(session.sessionId, selectedDate), fetchDashboard(session.sessionId, range)]);
  }

  async function deleteWorkoutLog(id: string): Promise<void> {
    if (!session) {
      return;
    }
    const response = await fetch(`/api/v1/workout-logs/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId })
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response, "운동 삭제에 실패했습니다.");
      setRecordsMessage({ type: "error", text: message });
      return;
    }

    setRecordsMessage({ type: "info", text: "운동 기록을 삭제했습니다." });
    await Promise.all([fetchDay(session.sessionId, selectedDate), fetchDashboard(session.sessionId, range)]);
  }

  async function saveBodyMetric(): Promise<void> {
    if (!session) {
      setRecordsMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }

    const weightKg = parseNumber(bodyMetricForm.weightKg);
    const bodyFatPct = parseNumber(bodyMetricForm.bodyFatPct);
    if (weightKg === undefined && bodyFatPct === undefined) {
      setRecordsMessage({ type: "error", text: "체중 또는 체지방 중 하나를 입력해 주세요." });
      return;
    }

    const response = await fetch("/api/v1/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: bodyMetricForm.date,
        ...(weightKg !== undefined ? { weightKg } : {}),
        ...(bodyFatPct !== undefined ? { bodyFatPct } : {})
      })
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response, "체성분 저장에 실패했습니다.");
      setRecordsMessage({ type: "error", text: message });
      return;
    }

    setRecordsMessage({ type: "success", text: "체성분 기록을 저장했습니다." });
    await Promise.all([fetchDay(session.sessionId, selectedDate), fetchDashboard(session.sessionId, range)]);
  }

  async function deleteBodyMetricLog(id: string): Promise<void> {
    if (!session) {
      return;
    }

    const response = await fetch(`/api/v1/body-metrics/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId })
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response, "체성분 삭제에 실패했습니다.");
      setRecordsMessage({ type: "error", text: message });
      return;
    }

    setRecordsMessage({ type: "info", text: "체성분 기록을 삭제했습니다." });
    await Promise.all([fetchDay(session.sessionId, selectedDate), fetchDashboard(session.sessionId, range)]);
  }

  async function saveGoal(): Promise<void> {
    if (!session) {
      setSettingsMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }

    const weeklyRoutineTarget = parseNumber(goalForm.weeklyRoutineTarget);
    if (!weeklyRoutineTarget || weeklyRoutineTarget < 1 || weeklyRoutineTarget > 21) {
      setSettingsMessage({ type: "error", text: "주간 루틴 목표는 1~21 범위여야 합니다." });
      return;
    }

    const response = await fetch("/api/v1/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        weeklyRoutineTarget: Math.trunc(weeklyRoutineTarget),
        ...(goalForm.dDay.trim() ? { dDay: goalForm.dDay.trim() } : {}),
        ...(parseNumber(goalForm.targetWeightKg) !== undefined
          ? { targetWeightKg: parseNumber(goalForm.targetWeightKg) }
          : {}),
        ...(parseNumber(goalForm.targetBodyFat) !== undefined
          ? { targetBodyFat: parseNumber(goalForm.targetBodyFat) }
          : {})
      })
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response, "목표 저장에 실패했습니다.");
      setSettingsMessage({ type: "error", text: message });
      return;
    }

    const payload = (await response.json()) as { data?: Goal };
    setGoal(payload.data ?? null);
    setSettingsMessage({ type: "success", text: "목표를 저장했습니다." });
    await fetchDashboard(session.sessionId, range);
  }

  async function createMealTemplateAction(): Promise<void> {
    if (!session) {
      return;
    }
    if (!mealTemplateForm.label.trim()) {
      setSettingsMessage({ type: "error", text: "식단 템플릿 이름을 입력해 주세요." });
      return;
    }

    const response = await fetch("/api/v1/templates/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        label: mealTemplateForm.label.trim(),
        mealSlot: mealTemplateForm.mealSlot,
        isActive: true
      })
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response, "식단 템플릿 저장에 실패했습니다.");
      setSettingsMessage({ type: "error", text: message });
      return;
    }

    setMealTemplateForm((prev) => ({ ...prev, label: "" }));
    await fetchTemplates(session.sessionId);
    setSettingsMessage({ type: "success", text: "식단 템플릿을 저장했습니다." });
  }

  async function deactivateMealTemplate(id: string): Promise<void> {
    if (!session) {
      return;
    }
    const response = await fetch(`/api/v1/templates/meals/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId })
    });
    if (!response.ok) {
      const message = await parseErrorMessage(response, "식단 템플릿 비활성화에 실패했습니다.");
      setSettingsMessage({ type: "error", text: message });
      return;
    }

    await fetchTemplates(session.sessionId);
    setSettingsMessage({ type: "info", text: "식단 템플릿을 비활성화했습니다." });
  }

  async function createWorkoutTemplateAction(): Promise<void> {
    if (!session) {
      return;
    }
    if (!workoutTemplateForm.label.trim()) {
      setSettingsMessage({ type: "error", text: "운동 템플릿 이름을 입력해 주세요." });
      return;
    }

    const defaultDuration = parseNumber(workoutTemplateForm.defaultDuration);
    const response = await fetch("/api/v1/templates/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        label: workoutTemplateForm.label.trim(),
        bodyPart: workoutTemplateForm.bodyPart,
        purpose: workoutTemplateForm.purpose,
        tool: workoutTemplateForm.tool,
        ...(defaultDuration !== undefined ? { defaultDuration: Math.trunc(defaultDuration) } : {}),
        isActive: true
      })
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response, "운동 템플릿 저장에 실패했습니다.");
      setSettingsMessage({ type: "error", text: message });
      return;
    }

    setWorkoutTemplateForm((prev) => ({ ...prev, label: "" }));
    await fetchTemplates(session.sessionId);
    setSettingsMessage({ type: "success", text: "운동 템플릿을 저장했습니다." });
  }

  async function deactivateWorkoutTemplate(id: string): Promise<void> {
    if (!session) {
      return;
    }

    const response = await fetch(`/api/v1/templates/workouts/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId })
    });
    if (!response.ok) {
      const message = await parseErrorMessage(response, "운동 템플릿 비활성화에 실패했습니다.");
      setSettingsMessage({ type: "error", text: message });
      return;
    }

    await fetchTemplates(session.sessionId);
    setSettingsMessage({ type: "info", text: "운동 템플릿을 비활성화했습니다." });
  }

  return (
    <>
      <section className="compact-header card">
        <div>
          <p className="header-eyebrow">ROUTINEMATE</p>
          <h1 className="header-title">오늘의 루틴을 빠르게 기록하고 복기하세요.</h1>
          <p className="header-sub">식단 체크인, 운동, 체성분, 목표를 페이지별로 분리해 관리합니다.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="button button-primary" onClick={() => void createGuestSession()}>
            게스트 세션 시작
          </button>
          <button
            type="button"
            className="button"
            disabled={!session}
            onClick={() => setSessionMessage({ type: "info", text: session ? `세션 ID: ${session.sessionId}` : "세션 없음" })}
          >
            세션 확인
          </button>
        </div>
        {sessionMessage ? <p className={`status status-${sessionMessage.type}`}>{sessionMessage.text}</p> : null}
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
                  {item}
                </button>
              ))}
            </div>
          </div>

          {dashboardMessage ? <p className={`status status-${dashboardMessage.type}`}>{dashboardMessage.text}</p> : null}

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
            <h3>
              점수 추세 ({dashboard?.granularity ?? "day"} 기준)
            </h3>
            {!dashboard || dashboard.buckets.length === 0 ? (
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
            <div className="section-head">
              <h2>기록 날짜</h2>
              <label className="field compact-field">
                <span>날짜</span>
                <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </label>
            </div>
            {recordsMessage ? <p className={`status status-${recordsMessage.type}`}>{recordsMessage.text}</p> : null}
          </section>

          <section className="card">
            <h2>식단 체크인</h2>
            <p className="hint">아침/점심/저녁/저녁2 슬롯에서 함/안함만 기록합니다. 템플릿 선택 시 즉시 저장됩니다.</p>
            <div className="slot-grid">
              {mealSlots.map((slot) => {
                const current = checkinBySlot.get(slot.value);
                const slotTemplates = activeMealTemplates.filter((item) => item.mealSlot === slot.value);
                return (
                  <article key={slot.value} className="slot-card">
                    <div className="slot-head">
                      <h3>{slot.label}</h3>
                      {current ? <span className="slot-state">{current.completed ? "함" : "안함"}</span> : <span className="slot-state">미기록</span>}
                    </div>
                    <div className="slot-actions">
                      <button type="button" className="button button-primary" onClick={() => void upsertMealCheckin(slot.value, true)}>
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
                    {slotTemplates.length > 0 ? (
                      <div className="chip-row">
                        {slotTemplates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            className={
                              current?.templateId === template.id ? "recommend-chip is-selected" : "recommend-chip"
                            }
                            onClick={() => void upsertMealCheckin(slot.value, true, template.id)}
                          >
                            {template.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="hint">설정 페이지에서 이 슬롯 템플릿을 추가하면 1탭 선택이 가능합니다.</p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="card split-grid">
            <article>
              <h2>운동 Quick Log</h2>
              {activeWorkoutTemplates.length > 0 ? (
                <div className="chip-row">
                  {activeWorkoutTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="recommend-chip"
                      onClick={() => void saveWorkoutLog(template)}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="hint">설정 페이지에서 운동 템플릿을 등록하면 1탭 저장이 가능합니다.</p>
              )}

              <div className="form-grid">
                <label className="field">
                  <span>날짜</span>
                  <input
                    type="date"
                    value={workoutForm.date}
                    onChange={(event) => setWorkoutForm((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>부위</span>
                  <select
                    value={workoutForm.bodyPart}
                    onChange={(event) =>
                      setWorkoutForm((prev) => ({ ...prev, bodyPart: event.target.value as BodyPart }))
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
                    value={workoutForm.purpose}
                    onChange={(event) =>
                      setWorkoutForm((prev) => ({ ...prev, purpose: event.target.value as WorkoutPurpose }))
                    }
                  >
                    {purposeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>도구</span>
                  <select
                    value={workoutForm.tool}
                    onChange={(event) => setWorkoutForm((prev) => ({ ...prev, tool: event.target.value as WorkoutTool }))}
                  >
                    {toolOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field full-span">
                  <span>운동명</span>
                  <input
                    type="text"
                    value={workoutForm.exerciseName}
                    onChange={(event) => setWorkoutForm((prev) => ({ ...prev, exerciseName: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>강도</span>
                  <select
                    value={workoutForm.intensity}
                    onChange={(event) =>
                      setWorkoutForm((prev) => ({ ...prev, intensity: event.target.value as WorkoutIntensity }))
                    }
                  >
                    {intensityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>시간(분)</span>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={workoutForm.durationMinutes}
                    onChange={(event) => setWorkoutForm((prev) => ({ ...prev, durationMinutes: event.target.value }))}
                  />
                </label>
              </div>
              <button type="button" className="button button-primary full-width" onClick={() => void saveWorkoutLog()}>
                운동 저장
              </button>
            </article>

            <article>
              <h2>체중/체지방 기록</h2>
              <div className="form-grid">
                <label className="field full-span">
                  <span>날짜</span>
                  <input
                    type="date"
                    value={bodyMetricForm.date}
                    onChange={(event) => setBodyMetricForm((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>체중(kg)</span>
                  <input
                    type="number"
                    value={bodyMetricForm.weightKg}
                    onChange={(event) => setBodyMetricForm((prev) => ({ ...prev, weightKg: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>체지방(%)</span>
                  <input
                    type="number"
                    value={bodyMetricForm.bodyFatPct}
                    onChange={(event) => setBodyMetricForm((prev) => ({ ...prev, bodyFatPct: event.target.value }))}
                  />
                </label>
              </div>
              <button type="button" className="button button-primary full-width" onClick={() => void saveBodyMetric()}>
                체성분 저장
              </button>
            </article>
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
                        <strong>{item.exerciseName}</strong>
                        <p className="hint">
                          {item.bodyPart} / {item.purpose} / {item.tool} / {item.durationMinutes ?? 30}분
                        </p>
                      </div>
                      <button type="button" className="button" onClick={() => void deleteWorkoutLog(item.id)}>
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
              {settingsMessage ? <p className={`status status-${settingsMessage.type}`}>{settingsMessage.text}</p> : null}
              <div className="form-grid">
                <label className="field">
                  <span>주간 루틴 목표(회)</span>
                  <input
                    type="number"
                    min={1}
                    max={21}
                    value={goalForm.weeklyRoutineTarget}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, weeklyRoutineTarget: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>D-day</span>
                  <input
                    type="date"
                    value={goalForm.dDay}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, dDay: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>목표 체중(kg)</span>
                  <input
                    type="number"
                    value={goalForm.targetWeightKg}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, targetWeightKg: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>목표 체지방(%)</span>
                  <input
                    type="number"
                    value={goalForm.targetBodyFat}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, targetBodyFat: event.target.value }))}
                  />
                </label>
              </div>
              <button type="button" className="button button-primary full-width" onClick={() => void saveGoal()}>
                목표 저장
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
                <label className="field full-span">
                  <span>기본 슬롯</span>
                  <select
                    value={mealTemplateForm.mealSlot}
                    onChange={(event) =>
                      setMealTemplateForm((prev) => ({ ...prev, mealSlot: event.target.value as MealSlot }))
                    }
                  >
                    {mealSlots.map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="button" className="button button-primary full-width" onClick={() => void createMealTemplateAction()}>
                식단 템플릿 추가
              </button>
              <div className="record-list">
                {mealTemplates.length === 0 ? (
                  <p className="hint">등록된 식단 템플릿이 없습니다.</p>
                ) : (
                  mealTemplates.map((item) => (
                    <div key={item.id} className="record-item">
                      <div>
                        <strong>{item.label}</strong>
                        <p className="hint">{item.mealSlot} / {item.isActive ? "활성" : "비활성"}</p>
                      </div>
                      {item.isActive ? (
                        <button type="button" className="button" onClick={() => void deactivateMealTemplate(item.id)}>
                          비활성화
                        </button>
                      ) : null}
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
                    onChange={(event) =>
                      setWorkoutTemplateForm((prev) => ({ ...prev, defaultDuration: event.target.value }))
                    }
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
                    onChange={(event) =>
                      setWorkoutTemplateForm((prev) => ({ ...prev, tool: event.target.value as WorkoutTool }))
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
              <button type="button" className="button button-primary full-width" onClick={() => void createWorkoutTemplateAction()}>
                운동 템플릿 추가
              </button>
              <div className="record-list">
                {workoutTemplates.length === 0 ? (
                  <p className="hint">등록된 운동 템플릿이 없습니다.</p>
                ) : (
                  workoutTemplates.map((item) => (
                    <div key={item.id} className="record-item">
                      <div>
                        <strong>{item.label}</strong>
                        <p className="hint">
                          {item.bodyPart} / {item.purpose} / {item.tool} / {item.defaultDuration ?? 30}분 / {item.isActive ? "활성" : "비활성"}
                        </p>
                      </div>
                      {item.isActive ? (
                        <button type="button" className="button" onClick={() => void deactivateWorkoutTemplate(item.id)}>
                          비활성화
                        </button>
                      ) : null}
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
