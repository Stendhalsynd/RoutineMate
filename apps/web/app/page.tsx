"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardSummary, Goal } from "@routinemate/domain";

type Range = "7d" | "30d" | "90d";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type PortionSize = "small" | "medium" | "large";
type LoadState = "idle" | "loading" | "success" | "error";

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

type Message = {
  type: "error" | "success" | "info";
  text: string;
};

type MealLogSnapshot = {
  id: string;
  foodLabel: string;
  mealType: MealType;
  portionSize: PortionSize;
  date: string;
};

type CalendarPayload = {
  data?: {
    mealLogs?: MealLogSnapshot[];
  };
};

const ranges = ["7d", "30d", "90d"] as const;

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

const sessionStorageKey = "routinemate-session-id";
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

function parseInteger(value: string): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

function parseDecimal(value: string): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function clampToDecimalDate(date: string): string {
  return date.slice(0, 10);
}

export default function HomePage() {
  const [range, setRange] = useState<Range>("7d");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<Message | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [dashboardState, setDashboardState] = useState<LoadState>("idle");

  const [goalForm, setGoalForm] = useState<GoalForm>({
    weeklyRoutineTarget: "4",
    dDay: "",
    targetWeightKg: "",
    targetBodyFat: ""
  });
  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null);
  const [goalState, setGoalState] = useState<LoadState>("idle");
  const [goalMessage, setGoalMessage] = useState<Message | null>(null);

  const [mealForm, setMealForm] = useState<MealForm>({
    date: todayYmd(),
    mealType: "lunch",
    foodLabel: "",
    portionSize: "medium"
  });
  const [mealState, setMealState] = useState<LoadState>("idle");
  const [mealMessage, setMealMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const saved = window.localStorage.getItem(sessionStorageKey);
    if (saved) {
      setSessionId(saved);
    }
  }, []);

  async function fetchDashboard(targetSessionId: string, targetRange: Range) {
    setDashboardState("loading");
    try {
      const response = await fetch(
        `/api/v1/dashboard?sessionId=${encodeURIComponent(targetSessionId)}&range=${encodeURIComponent(targetRange)}`
      );
      if (!response.ok) {
        setDashboardState("error");
        return;
      }
      const payload = (await response.json()) as { data?: DashboardSummary };
      setDashboard(payload.data ?? null);
      setDashboardState("success");
    } catch {
      setDashboardState("error");
    }
  }

  async function fetchGoal(targetSessionId: string) {
    setGoalState("loading");
    try {
      const response = await fetch(`/api/v1/goals?sessionId=${encodeURIComponent(targetSessionId)}`);
      if (!response.ok) {
        setGoalState("error");
        return;
      }
      const payload = (await response.json()) as {
        data?: { goal?: Goal | null; goals?: Goal[] };
      };
      const goal = payload.data?.goal ?? payload.data?.goals?.[0] ?? null;
      setCurrentGoal(goal ?? null);
      if (goal) {
        setGoalForm({
          weeklyRoutineTarget: String(goal.weeklyRoutineTarget),
          dDay: goal.dDay ?? "",
          targetWeightKg: goal.targetWeightKg?.toString() ?? "",
          targetBodyFat: goal.targetBodyFat?.toString() ?? ""
        });
      }
      setGoalState("success");
    } catch {
      setGoalState("error");
    }
  }

  async function createGuestSession() {
    setSessionMessage(null);
    try {
      const response = await fetch("/api/v1/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (!response.ok) {
        setSessionMessage({ type: "error", text: "게스트 세션 생성에 실패했습니다." });
        return;
      }
      const payload = (await response.json()) as { data?: { sessionId?: string } };
      const nextSessionId = payload.data?.sessionId;
      if (!nextSessionId) {
        setSessionMessage({ type: "error", text: "세션 응답이 비정상입니다." });
        return;
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(sessionStorageKey, nextSessionId);
      }
      setSessionId(nextSessionId);
      setMealForm((prev) => ({ ...prev, date: todayYmd() }));
      setSessionMessage({ type: "success", text: "게스트 세션이 시작되었습니다." });
      await fetchGoal(nextSessionId);
      await fetchDashboard(nextSessionId, range);
    } catch {
      setSessionMessage({ type: "error", text: "게스트 세션 생성에 실패했습니다." });
    }
  }

  async function fetchMealLogsByDate(targetSessionId: string, date: string): Promise<MealLogSnapshot[]> {
    const response = await fetch(
      `/api/v1/calendar/day?sessionId=${encodeURIComponent(targetSessionId)}&date=${encodeURIComponent(clampToDecimalDate(date))}`
    );
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as CalendarPayload;
    if (!payload.data || !Array.isArray(payload.data.mealLogs)) {
      return [];
    }
    return payload.data.mealLogs;
  }

  async function copyMealFromDate(date: string, label: string) {
    if (!sessionId) {
      setMealMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    setMealState("loading");
    setMealMessage({ type: "info", text: `${label} 기록을 불러오는 중입니다.` });
    try {
      const logs = await fetchMealLogsByDate(sessionId, date);
      if (logs.length === 0) {
        setMealMessage({ type: "error", text: `${label} 기록이 없습니다.` });
        setMealState("error");
        return;
      }
      const latest = logs[0];
      setMealForm({
        date,
        mealType: latest.mealType,
        foodLabel: latest.foodLabel,
        portionSize: latest.portionSize
      });
      setMealMessage({ type: "success", text: `${label} 기록을 적용했습니다.` });
      setMealState("success");
    } catch {
      setMealMessage({ type: "error", text: `${label} 기록 복사에 실패했습니다.` });
      setMealState("error");
    }
  }

  async function copyMostRecentMeal() {
    if (!sessionId) {
      setMealMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    setMealState("loading");
    setMealMessage({ type: "info", text: "최근 식단 기록을 검색합니다." });
    for (let i = 1; i <= recentSearchLimit; i++) {
      const date = ymdOffset(-i);
      // eslint-disable-next-line no-await-in-loop
      const logs = await fetchMealLogsByDate(sessionId, date);
      if (logs.length > 0) {
        const latest = logs[0];
        setMealForm({
          date,
          mealType: latest.mealType,
          foodLabel: latest.foodLabel,
          portionSize: latest.portionSize
        });
        setMealMessage({ type: "success", text: `${date} 식단으로 복사했습니다.` });
        setMealState("success");
        return;
      }
    }
    setMealMessage({ type: "error", text: `${recentSearchLimit}일 이내 식단 기록이 없습니다.` });
    setMealState("error");
  }

  async function saveGoal() {
    if (!sessionId) {
      setGoalMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    setGoalMessage(null);
    const weeklyRoutineTarget = parseInteger(goalForm.weeklyRoutineTarget);
    if (weeklyRoutineTarget === undefined || weeklyRoutineTarget < 1 || weeklyRoutineTarget > 21) {
      setGoalMessage({ type: "error", text: "주간 루틴 목표는 1~21회로 입력해 주세요." });
      return;
    }
    const targetWeightKg = parseDecimal(goalForm.targetWeightKg);
    if (targetWeightKg !== undefined && (targetWeightKg <= 0 || targetWeightKg > 400)) {
      setGoalMessage({ type: "error", text: "목표 체중은 0초과 400 이하로 입력해 주세요." });
      return;
    }
    const targetBodyFat = parseDecimal(goalForm.targetBodyFat);
    if (targetBodyFat !== undefined && (targetBodyFat < 1 || targetBodyFat > 70)) {
      setGoalMessage({ type: "error", text: "목표 체지방은 1~70 사이로 입력해 주세요." });
      return;
    }
    if (goalForm.dDay && !/^\d{4}-\d{2}-\d{2}$/.test(goalForm.dDay)) {
      setGoalMessage({ type: "error", text: "D-day는 YYYY-MM-DD 형식으로 입력해 주세요." });
      return;
    }

    const payload: Record<string, unknown> = {
      sessionId,
      weeklyRoutineTarget
    };
    if (goalForm.dDay.trim()) {
      payload.dDay = goalForm.dDay.trim();
    }
    if (targetWeightKg !== undefined) {
      payload.targetWeightKg = targetWeightKg;
    }
    if (targetBodyFat !== undefined) {
      payload.targetBodyFat = targetBodyFat;
    }

    setGoalState("loading");
    try {
      const response = await fetch("/api/v1/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        setGoalMessage({ type: "error", text: "목표 저장에 실패했습니다." });
        setGoalState("error");
        return;
      }
      const payloadResponse = (await response.json()) as { data?: Goal };
      const nextGoal = payloadResponse.data;
      if (nextGoal) {
        setCurrentGoal(nextGoal);
        setGoalForm({
          weeklyRoutineTarget: String(nextGoal.weeklyRoutineTarget),
          dDay: nextGoal.dDay ?? "",
          targetWeightKg: nextGoal.targetWeightKg?.toString() ?? "",
          targetBodyFat: nextGoal.targetBodyFat?.toString() ?? ""
        });
      }
      setGoalMessage({ type: "success", text: "목표가 저장되었습니다." });
      setGoalState("success");
      await fetchDashboard(sessionId, range);
      await fetchGoal(sessionId);
    } catch {
      setGoalMessage({ type: "error", text: "목표 저장 중 오류가 발생했습니다." });
      setGoalState("error");
    }
  }

  async function saveMealLog() {
    if (!sessionId) {
      setMealMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    const foodLabel = mealForm.foodLabel.trim();
    if (foodLabel.length === 0) {
      setMealMessage({ type: "error", text: "음식명을 입력해 주세요." });
      return;
    }

    setMealState("loading");
    try {
      const response = await fetch("/api/v1/meal-logs/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          date: clampToDecimalDate(mealForm.date),
          mealType: mealForm.mealType,
          foodLabel,
          portionSize: mealForm.portionSize
        })
      });
      if (!response.ok) {
        setMealMessage({ type: "error", text: "식단 저장에 실패했습니다." });
        setMealState("error");
        return;
      }
      await response.json();
      setMealForm((prev) => ({
        ...prev,
        foodLabel: ""
      }));
      setMealMessage({ type: "success", text: "식단이 저장되었습니다." });
      setMealState("success");
      await fetchDashboard(sessionId, range);
    } catch {
      setMealMessage({ type: "error", text: "식단 저장 중 오류가 발생했습니다." });
      setMealState("error");
    }
  }

  useEffect(() => {
    if (!sessionId) {
      setDashboard(null);
      setCurrentGoal(null);
      return;
    }
    void fetchGoal(sessionId);
    void fetchDashboard(sessionId, range);
  }, [sessionId, range]);

  const goalProgress = dashboard?.goals?.[0];
  const adherenceLabel = dashboard ? formatPercent(dashboard.adherenceRate) : "--";
  const mealSummary = dashboard ? `${dashboard.totalMeals}건` : "--";
  const workoutSummary = dashboard ? `${dashboard.totalWorkouts}건` : "--";

  const statusLabel = useMemo(() => {
    if (!goalProgress) {
      return "목표가 아직 없습니다.";
    }
    return `${goalProgress.completedRoutineCount}회 완료 / 주간목표 ${goalProgress.weeklyRoutineTarget}회`;
  }, [goalProgress]);

  return (
    <main className="layout">
      <section className="hero">
        <div>
          <p className="eyebrow">RoutineMate MVP</p>
          <h1>루틴 메이트로 빠르게 기록하고, 가독성 있게 복기한다.</h1>
          <p className="subtext">식단/운동 기록은 3탭 안에. 날짜별 진행률은 한 화면에서 확인합니다.</p>
        </div>
        <div className="actions">
          <button type="button" className="button button-primary button-reset" onClick={createGuestSession}>
            게스트 세션 시작
          </button>
          <button
            type="button"
            className="button"
            disabled={!sessionId}
            onClick={() => {
              if (!sessionId) {
                setSessionMessage({ type: "error", text: "세션이 없습니다." });
                return;
              }
              setSessionMessage({ type: "info", text: `세션 ID: ${sessionId}` });
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
                disabled={!sessionId}
              >
                {item}
              </button>
              ))}
          </div>
        </div>
        <div className="kpi-grid">
          <article className="kpi-card">
            <h2>체크인율</h2>
            <p>{adherenceLabel}</p>
          </article>
          <article className="kpi-card">
            <h2>식단 로그</h2>
            <p>{mealSummary}</p>
          </article>
          <article className="kpi-card">
            <h2>운동 로그</h2>
            <p>{workoutSummary}</p>
          </article>
          <article className="kpi-card">
            <h2>목표 달성률</h2>
            <p>{goalProgress ? formatPercent(goalProgress.routineCompletionRate) : "--"}</p>
          </article>
        </div>
        <p className="hint">
          {dashboardState === "loading"
            ? "대시보드 새로고침 중입니다."
            : dashboardState === "error"
              ? "대시보드 조회 실패"
              : statusLabel}
        </p>
      </section>

      <section className="split-grid">
        <article className="card">
          <h2>목표 설정</h2>
          <p className="hint">루틴이 어렵지 않게 유지되도록 주간 루틴·체중·체지방 목표를 한곳에 모아 설정합니다.</p>
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
                required
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
                placeholder="예: 68"
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
                placeholder="예: 19"
              />
            </label>
            <button type="submit" className="button button-primary button-reset" disabled={goalState === "loading"}>
              목표 저장
            </button>
          </form>
          {goalMessage ? <p className={`status status-${goalMessage.type}`}>{goalMessage.text}</p> : null}
          {currentGoal ? (
            <div className="goal-summary">
              <p className="hint">현재 반영된 목표</p>
              <p className="hint">
                주 {currentGoal.weeklyRoutineTarget}회 / 목표 체중 {currentGoal.targetWeightKg ?? "미설정"}kg / 목표 체지방{" "}
                {currentGoal.targetBodyFat ?? "미설정"}%
              </p>
            </div>
          ) : null}
        </article>

        <article className="card">
          <h2>식단 Quick Log</h2>
          <p className="hint">
            식사명 입력은 자유 텍스트로 빠르게 처리하고, 어제/최근 기록을 1탭으로 재기록할 수 있습니다.
          </p>
          <div className="inline-actions">
            <button
              type="button"
              className="button"
              disabled={!sessionId || mealState === "loading"}
              onClick={() => {
                void copyMealFromDate(ymdOffset(-1), "어제");
              }}
            >
              어제 기록 복사
            </button>
            <button
              type="button"
              className="button"
              disabled={!sessionId || mealState === "loading"}
              onClick={() => {
                void copyMostRecentMeal();
              }}
            >
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
                placeholder="예: 닭가슴살 샐러드"
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
            <button type="submit" className="button button-primary button-reset" disabled={mealState === "loading"}>
              식단 저장
            </button>
          </form>
          {mealMessage ? <p className={`status status-${mealMessage.type}`}>{mealMessage.text}</p> : null}
        </article>
      </section>

      <section className="card">
        <h2>빠른 API 확인</h2>
        <p className="hint">로컬에서 기본 연결이 필요한 API 경로</p>
        <div className="endpoint-grid">
          <code>POST /v1/auth/guest</code>
          <code>GET /v1/goals?sessionId=...</code>
          <code>POST /v1/goals</code>
          <code>POST /v1/meal-logs/quick</code>
          <code>GET /v1/calendar/day?sessionId=...&amp;date=...</code>
          <code>GET /v1/dashboard?sessionId=...&amp;range=7d|30d|90d</code>
        </div>
      </section>
    </main>
  );
}
