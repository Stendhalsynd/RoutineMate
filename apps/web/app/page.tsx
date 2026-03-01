"use client";

import { useEffect, useMemo, useState } from "react";
import { buildCalendarUiCells } from "@/lib/calendar-summary";
import type {
  BodyPart,
  DashboardSummary,
  Goal,
  MealType,
  PortionSize,
  RangeKey,
  WorkoutIntensity,
  WorkoutPurpose,
  WorkoutSuggestion,
  WorkoutTool
} from "@routinemate/domain";

type MessageType = "error" | "success" | "info";
type Message = {
  type: MessageType;
  text: string;
};

type SessionPayload = {
  sessionId: string;
  userId: string;
};

type GoalForm = {
  weeklyRoutineTarget: string;
  dDay: string;
  targetWeightKg: string;
  targetBodyFat: string;
};

type MealForm = {
  date: string;
  mealType: MealType;
  foodLabel: string;
  portionSize: PortionSize;
};

type WorkoutForm = {
  date: string;
  bodyPart: BodyPart;
  purpose: WorkoutPurpose;
  tool: WorkoutTool;
  exerciseName: string;
  intensity: WorkoutIntensity;
  durationMinutes: string;
};

type BodyMetricForm = {
  date: string;
  weightKg: string;
  bodyFatPct: string;
};

const ranges: RangeKey[] = ["7d", "30d", "90d"];

const mealTypeOptions: Array<{ value: MealType; label: string }> = [
  { value: "breakfast", label: "아침" },
  { value: "lunch", label: "점심" },
  { value: "dinner", label: "저녁" },
  { value: "snack", label: "간식" }
];

const portionOptions: Array<{ value: PortionSize; label: string }> = [
  { value: "small", label: "작게" },
  { value: "medium", label: "보통" },
  { value: "large", label: "많이" }
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

const recentSearchLimit = 14;

function todayYmd(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function ymdOffset(days: number): string {
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + days);
  return `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
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
  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  return payload?.error?.message ?? fallback;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export default function HomePage() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [range, setRange] = useState<RangeKey>("7d");
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [workoutSuggestions, setWorkoutSuggestions] = useState<WorkoutSuggestion[]>([]);

  const [sessionMessage, setSessionMessage] = useState<Message | null>(null);
  const [goalMessage, setGoalMessage] = useState<Message | null>(null);
  const [mealMessage, setMealMessage] = useState<Message | null>(null);
  const [workoutMessage, setWorkoutMessage] = useState<Message | null>(null);
  const [metricMessage, setMetricMessage] = useState<Message | null>(null);

  const [goalForm, setGoalForm] = useState<GoalForm>({
    weeklyRoutineTarget: "4",
    dDay: "",
    targetWeightKg: "",
    targetBodyFat: ""
  });

  const [mealForm, setMealForm] = useState<MealForm>({
    date: todayYmd(),
    mealType: "lunch",
    foodLabel: "",
    portionSize: "medium"
  });

  const [workoutForm, setWorkoutForm] = useState<WorkoutForm>({
    date: todayYmd(),
    bodyPart: "full_body",
    purpose: "fat_loss",
    tool: "bodyweight",
    exerciseName: "",
    intensity: "medium",
    durationMinutes: "30"
  });

  const [metricForm, setMetricForm] = useState<BodyMetricForm>({
    date: todayYmd(),
    weightKg: "",
    bodyFatPct: ""
  });

  async function fetchDashboard(currentSessionId: string, currentRange: RangeKey): Promise<void> {
    const response = await fetch(
      `/api/v1/dashboard?sessionId=${encodeURIComponent(currentSessionId)}&range=${encodeURIComponent(currentRange)}`
    );
    if (!response.ok) {
      const message = await parseErrorMessage(response, "대시보드 조회에 실패했습니다.");
      setSessionMessage({ type: "error", text: message });
      return;
    }
    const payload = (await response.json()) as { data?: DashboardSummary };
    setDashboard(payload.data ?? null);
  }

  async function fetchGoal(currentSessionId: string): Promise<void> {
    const response = await fetch(`/api/v1/goals?sessionId=${encodeURIComponent(currentSessionId)}`);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { data?: { goal?: Goal | null } };
    const currentGoal = payload.data?.goal ?? null;
    setGoal(currentGoal);
    if (currentGoal) {
      setGoalForm({
        weeklyRoutineTarget: String(currentGoal.weeklyRoutineTarget),
        dDay: currentGoal.dDay ?? "",
        targetWeightKg: currentGoal.targetWeightKg?.toString() ?? "",
        targetBodyFat: currentGoal.targetBodyFat?.toString() ?? ""
      });
    }
  }

  async function fetchWorkoutSuggestions(form: WorkoutForm): Promise<void> {
    const response = await fetch(
      `/api/v1/workout-suggestions?bodyPart=${encodeURIComponent(form.bodyPart)}&purpose=${encodeURIComponent(form.purpose)}&tool=${encodeURIComponent(form.tool)}`
    );
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      data?: { suggestions?: WorkoutSuggestion[] };
    };
    setWorkoutSuggestions(payload.data?.suggestions ?? []);
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
    await fetchGoal(payload.data.sessionId);
    await fetchDashboard(payload.data.sessionId, range);
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
    void fetchWorkoutSuggestions(workoutForm);
  }, [workoutForm.bodyPart, workoutForm.purpose, workoutForm.tool]);

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
      setSessionMessage({ type: "error", text: "세션 생성 응답이 비정상입니다." });
      return;
    }
    setSession(payload.data);
    setSessionMessage({ type: "success", text: "게스트 세션이 시작되었습니다." });
    await fetchGoal(payload.data.sessionId);
    await fetchDashboard(payload.data.sessionId, range);
  }

  async function saveGoal(): Promise<void> {
    if (!session) {
      setGoalMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    const weeklyRoutineTarget = parseNumber(goalForm.weeklyRoutineTarget);
    if (!weeklyRoutineTarget || weeklyRoutineTarget < 1 || weeklyRoutineTarget > 21) {
      setGoalMessage({ type: "error", text: "주간 루틴 목표는 1~21 사이여야 합니다." });
      return;
    }
    const body: Record<string, unknown> = {
      sessionId: session.sessionId,
      weeklyRoutineTarget: Math.trunc(weeklyRoutineTarget)
    };
    const targetWeightKg = parseNumber(goalForm.targetWeightKg);
    if (targetWeightKg !== undefined) {
      body.targetWeightKg = targetWeightKg;
    }
    const targetBodyFat = parseNumber(goalForm.targetBodyFat);
    if (targetBodyFat !== undefined) {
      body.targetBodyFat = targetBodyFat;
    }
    if (goalForm.dDay.trim()) {
      body.dDay = goalForm.dDay.trim();
    }

    const response = await fetch("/api/v1/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const message = await parseErrorMessage(response, "목표 저장에 실패했습니다.");
      setGoalMessage({ type: "error", text: message });
      return;
    }

    const payload = (await response.json()) as { data?: Goal };
    if (payload.data) {
      setGoal(payload.data);
    }
    setGoalMessage({ type: "success", text: "목표를 저장했습니다." });
    await fetchDashboard(session.sessionId, range);
  }

  async function saveMealLog(): Promise<void> {
    if (!session) {
      setMealMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    if (!mealForm.foodLabel.trim()) {
      setMealMessage({ type: "error", text: "음식명을 입력해 주세요." });
      return;
    }

    const response = await fetch("/api/v1/meal-logs/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: mealForm.date,
        mealType: mealForm.mealType,
        foodLabel: mealForm.foodLabel.trim(),
        portionSize: mealForm.portionSize
      })
    });
    if (!response.ok) {
      const message = await parseErrorMessage(response, "식단 저장에 실패했습니다.");
      setMealMessage({ type: "error", text: message });
      return;
    }

    setMealForm((prev) => ({ ...prev, foodLabel: "" }));
    setMealMessage({ type: "success", text: "식단을 저장했습니다." });
    await fetchDashboard(session.sessionId, range);
  }

  async function saveWorkoutLog(): Promise<void> {
    if (!session) {
      setWorkoutMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    const durationMinutes = parseNumber(workoutForm.durationMinutes);
    if (!durationMinutes || durationMinutes < 1 || durationMinutes > 300) {
      setWorkoutMessage({ type: "error", text: "운동 시간은 1~300분으로 입력해 주세요." });
      return;
    }

    const exerciseName = workoutForm.exerciseName.trim() || workoutSuggestions[0]?.exerciseName || "기본 운동";

    const response = await fetch("/api/v1/workout-logs/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: workoutForm.date,
        bodyPart: workoutForm.bodyPart,
        purpose: workoutForm.purpose,
        tool: workoutForm.tool,
        exerciseName,
        intensity: workoutForm.intensity,
        durationMinutes: Math.trunc(durationMinutes)
      })
    });
    if (!response.ok) {
      const message = await parseErrorMessage(response, "운동 저장에 실패했습니다.");
      setWorkoutMessage({ type: "error", text: message });
      return;
    }

    setWorkoutForm((prev) => ({
      ...prev,
      exerciseName: ""
    }));
    setWorkoutMessage({ type: "success", text: `${exerciseName} 운동을 저장했습니다.` });
    await fetchDashboard(session.sessionId, range);
  }

  async function saveBodyMetric(): Promise<void> {
    if (!session) {
      setMetricMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    const weightKg = parseNumber(metricForm.weightKg);
    const bodyFatPct = parseNumber(metricForm.bodyFatPct);
    if (weightKg === undefined && bodyFatPct === undefined) {
      setMetricMessage({ type: "error", text: "체중 또는 체지방 중 하나는 입력해 주세요." });
      return;
    }

    const response = await fetch("/api/v1/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        date: metricForm.date,
        ...(weightKg !== undefined ? { weightKg } : {}),
        ...(bodyFatPct !== undefined ? { bodyFatPct } : {})
      })
    });
    if (!response.ok) {
      const message = await parseErrorMessage(response, "체성분 저장에 실패했습니다.");
      setMetricMessage({ type: "error", text: message });
      return;
    }

    setMetricMessage({ type: "success", text: "체성분 기록을 저장했습니다." });
    await fetchDashboard(session.sessionId, range);
  }

  async function copyMealFromDate(date: string, label: string): Promise<void> {
    if (!session) {
      setMealMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    const response = await fetch(
      `/api/v1/calendar/day?sessionId=${encodeURIComponent(session.sessionId)}&date=${encodeURIComponent(date)}`
    );
    if (!response.ok) {
      const message = await parseErrorMessage(response, `${label} 식단 기록을 불러오지 못했습니다.`);
      setMealMessage({ type: "error", text: message });
      return;
    }
    const payload = (await response.json()) as {
      data?: {
        mealLogs?: Array<{
          date: string;
          mealType: MealType;
          foodLabel: string;
          portionSize: PortionSize;
        }>;
      };
    };
    const latest = payload.data?.mealLogs?.[0];
    if (!latest) {
      setMealMessage({ type: "error", text: `${label} 기록이 없습니다.` });
      return;
    }
    setMealForm({
      date,
      mealType: latest.mealType,
      foodLabel: latest.foodLabel,
      portionSize: latest.portionSize
    });
    setMealMessage({ type: "success", text: `${label} 식단을 복사했습니다.` });
  }

  async function copyMostRecentMeal(): Promise<void> {
    if (!session) {
      setMealMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    for (let i = 1; i <= recentSearchLimit; i++) {
      const date = ymdOffset(-i);
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(
        `/api/v1/calendar/day?sessionId=${encodeURIComponent(session.sessionId)}&date=${encodeURIComponent(date)}`
      );
      if (!response.ok) {
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const payload = (await response.json()) as {
        data?: {
          mealLogs?: Array<{
            date: string;
            mealType: MealType;
            foodLabel: string;
            portionSize: PortionSize;
          }>;
        };
      };
      const latest = payload.data?.mealLogs?.[0];
      if (latest) {
        setMealForm({
          date,
          mealType: latest.mealType,
          foodLabel: latest.foodLabel,
          portionSize: latest.portionSize
        });
        setMealMessage({ type: "success", text: `${date} 식단을 복사했습니다.` });
        return;
      }
    }
    setMealMessage({ type: "error", text: `${recentSearchLimit}일 내 복사할 식단이 없습니다.` });
  }

  const goalProgress = dashboard?.goals?.[0];
  const calendarCells = useMemo(() => buildCalendarUiCells(dashboard?.daily ?? []), [dashboard?.daily]);
  const statusLabel = useMemo(() => {
    if (!goalProgress) {
      return "목표가 아직 없습니다.";
    }
    return `${goalProgress.completedRoutineCount}회 완료 / 주간 목표 ${goalProgress.weeklyRoutineTarget}회`;
  }, [goalProgress]);

  return (
    <main className="layout">
      <section className="hero">
        <div>
          <p className="eyebrow">RoutineMate MVP</p>
          <h1>루틴 메이트로 빠르게 기록하고, 가독성 있게 복기한다.</h1>
          <p className="subtext">Notion DB 기반으로 식단/운동/체성분/목표를 서버에서 일관되게 관리합니다.</p>
        </div>
        <div className="actions">
          <button type="button" className="button button-primary button-reset" onClick={() => void createGuestSession()}>
            게스트 세션 시작
          </button>
          <button
            type="button"
            className="button"
            disabled={!session}
            onClick={() => {
              if (!session) {
                return;
              }
              setSessionMessage({ type: "info", text: `세션 ID: ${session.sessionId}` });
            }}
          >
            세션 확인
          </button>
        </div>
        {sessionMessage ? <p className={`status status-${sessionMessage.type}`}>{sessionMessage.text}</p> : null}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>대시보드 범위</h2>
          <div className="range-toggle" role="group" aria-label="Dashboard range">
            {ranges.map((item) => (
              <button
                key={item}
                type="button"
                className={item === range ? "active" : ""}
                onClick={() => setRange(item)}
                disabled={!session}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="kpi-grid">
          <article className="kpi-card">
            <h2>체크인율</h2>
            <p>{dashboard ? formatPercent(dashboard.adherenceRate) : "--"}</p>
          </article>
          <article className="kpi-card">
            <h2>식단 로그</h2>
            <p>{dashboard ? `${dashboard.totalMeals}건` : "--"}</p>
          </article>
          <article className="kpi-card">
            <h2>운동 로그</h2>
            <p>{dashboard ? `${dashboard.totalWorkouts}건` : "--"}</p>
          </article>
          <article className="kpi-card">
            <h2>목표 달성률</h2>
            <p>{goalProgress ? formatPercent(goalProgress.routineCompletionRate) : "--"}</p>
          </article>
        </div>
        <p className="hint">{statusLabel}</p>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>캘린더 요약</h2>
          <p className="hint">M: 식단 / W: 운동 / B: 체성분</p>
        </div>
        {calendarCells.length === 0 ? (
          <p className="hint">세션을 시작하면 최근 기간의 날짜별 기록 점수를 표시합니다.</p>
        ) : (
          <div className="calendar-grid">
            {calendarCells.map((cell) => (
              <article key={cell.date} className={`calendar-cell calendar-${cell.color}`}>
                <p className="calendar-date">{cell.dayLabel}</p>
                <p className="calendar-score">{cell.overallScore}</p>
                <div className="calendar-badges">
                  {cell.badges.length > 0 ? (
                    cell.badges.map((badge) => (
                      <span key={`${cell.date}-${badge}`} className="calendar-badge">
                        {badge}
                      </span>
                    ))
                  ) : (
                    <span className="calendar-empty">No Log</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="split-grid">
        <article className="card">
          <h2>목표 설정</h2>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void saveGoal();
            }}
          >
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
                min={1}
                max={400}
                value={goalForm.targetWeightKg}
                onChange={(event) => setGoalForm((prev) => ({ ...prev, targetWeightKg: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>목표 체지방(%)</span>
              <input
                type="number"
                min={1}
                max={70}
                value={goalForm.targetBodyFat}
                onChange={(event) => setGoalForm((prev) => ({ ...prev, targetBodyFat: event.target.value }))}
              />
            </label>
            <button type="submit" className="button button-primary button-reset full-span">
              목표 저장
            </button>
          </form>
          {goalMessage ? <p className={`status status-${goalMessage.type}`}>{goalMessage.text}</p> : null}
          {goal ? (
            <div className="goal-summary">
              <p className="hint">
                현재 목표: 주 {goal.weeklyRoutineTarget}회 / 체중 {goal.targetWeightKg ?? "미설정"}kg / 체지방{" "}
                {goal.targetBodyFat ?? "미설정"}%
              </p>
            </div>
          ) : null}
        </article>

        <article className="card">
          <h2>식단 Quick Log</h2>
          <div className="inline-actions">
            <button type="button" className="button" disabled={!session} onClick={() => void copyMealFromDate(ymdOffset(-1), "어제")}>
              어제 기록 복사
            </button>
            <button type="button" className="button" disabled={!session} onClick={() => void copyMostRecentMeal()}>
              최근 기록 복사
            </button>
          </div>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void saveMealLog();
            }}
          >
            <label className="field">
              <span>날짜</span>
              <input
                type="date"
                value={mealForm.date}
                onChange={(event) => setMealForm((prev) => ({ ...prev, date: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>식사 구분</span>
              <select
                value={mealForm.mealType}
                onChange={(event) => setMealForm((prev) => ({ ...prev, mealType: event.target.value as MealType }))}
              >
                {mealTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>음식</span>
              <input
                type="text"
                value={mealForm.foodLabel}
                onChange={(event) => setMealForm((prev) => ({ ...prev, foodLabel: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>분량</span>
              <select
                value={mealForm.portionSize}
                onChange={(event) => setMealForm((prev) => ({ ...prev, portionSize: event.target.value as PortionSize }))}
              >
                {portionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="button button-primary button-reset full-span">
              식단 저장
            </button>
          </form>
          {mealMessage ? <p className={`status status-${mealMessage.type}`}>{mealMessage.text}</p> : null}
        </article>
      </section>

      <section className="split-grid">
        <article className="card">
          <h2>운동 Quick Log</h2>
          <p className="hint">운동명이 헷갈리면 부위/목적/도구 조합을 먼저 선택하세요.</p>
          <div className="recommend-row">
            {workoutSuggestions.map((item) => (
              <button
                key={`${item.bodyPart}-${item.exerciseName}`}
                type="button"
                className="recommend-chip"
                onClick={() => setWorkoutForm((prev) => ({ ...prev, exerciseName: item.exerciseName }))}
              >
                {item.exerciseName}
              </button>
            ))}
          </div>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void saveWorkoutLog();
            }}
          >
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
                onChange={(event) => setWorkoutForm((prev) => ({ ...prev, bodyPart: event.target.value as BodyPart }))}
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
            <label className="field">
              <span>운동명</span>
              <input
                type="text"
                value={workoutForm.exerciseName}
                onChange={(event) => setWorkoutForm((prev) => ({ ...prev, exerciseName: event.target.value }))}
                placeholder="모르면 추천 칩 선택"
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
            <button type="submit" className="button button-primary button-reset full-span">
              운동 저장
            </button>
          </form>
          {workoutMessage ? <p className={`status status-${workoutMessage.type}`}>{workoutMessage.text}</p> : null}
        </article>

        <article className="card">
          <h2>체중/체지방 기록</h2>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void saveBodyMetric();
            }}
          >
            <label className="field">
              <span>날짜</span>
              <input
                type="date"
                value={metricForm.date}
                onChange={(event) => setMetricForm((prev) => ({ ...prev, date: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>체중(kg)</span>
              <input
                type="number"
                min={1}
                max={400}
                value={metricForm.weightKg}
                onChange={(event) => setMetricForm((prev) => ({ ...prev, weightKg: event.target.value }))}
                placeholder="예: 72.4"
              />
            </label>
            <label className="field">
              <span>체지방(%)</span>
              <input
                type="number"
                min={1}
                max={70}
                value={metricForm.bodyFatPct}
                onChange={(event) => setMetricForm((prev) => ({ ...prev, bodyFatPct: event.target.value }))}
                placeholder="예: 19.3"
              />
            </label>
            <button type="submit" className="button button-primary button-reset full-span">
              체성분 저장
            </button>
          </form>
          {metricMessage ? <p className={`status status-${metricMessage.type}`}>{metricMessage.text}</p> : null}
        </article>
      </section>
    </main>
  );
}
