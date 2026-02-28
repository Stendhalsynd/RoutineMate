"use client";

import { useEffect, useMemo, useState } from "react";
import { aggregateDashboard } from "@/lib/dashboard";
import type {
  BodyMetric,
  BodyPart,
  Goal,
  MealLog,
  MealType,
  PortionSize,
  RangeKey,
  WorkoutIntensity,
  WorkoutLog,
  WorkoutPurpose,
  WorkoutTool
} from "@routinemate/domain";

type MessageType = "error" | "success" | "info";

type Message = {
  type: MessageType;
  text: string;
};

type LocalSession = {
  sessionId: string;
  userId: string;
  createdAt: string;
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

const exerciseCandidates: Record<BodyPart, string[]> = {
  chest: ["푸시업", "벤치프레스", "덤벨 프레스"],
  back: ["랫 풀다운", "바벨 로우", "시티드 로우"],
  legs: ["스쿼트", "런지", "레그 프레스"],
  core: ["플랭크", "데드버그", "행잉 레그레이즈"],
  shoulders: ["숄더 프레스", "레터럴 레이즈", "리어 델트 플라이"],
  arms: ["바벨 컬", "트라이셉스 푸시다운", "해머 컬"],
  full_body: ["버피", "쓰러스터", "클린 앤 프레스"],
  cardio: ["런닝", "사이클", "줄넘기"]
};

const storageKeys = {
  session: "routinemate.local.session.v1",
  meals: "routinemate.local.meals.v1",
  workouts: "routinemate.local.workouts.v1",
  goals: "routinemate.local.goals.v1",
  metrics: "routinemate.local.metrics.v1"
} as const;

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

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
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

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export default function HomePage() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [session, setSession] = useState<LocalSession | null>(null);

  const [allMeals, setAllMeals] = useState<MealLog[]>([]);
  const [allWorkouts, setAllWorkouts] = useState<WorkoutLog[]>([]);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [allMetrics] = useState<BodyMetric[]>([]);

  const [sessionMessage, setSessionMessage] = useState<Message | null>(null);
  const [goalMessage, setGoalMessage] = useState<Message | null>(null);
  const [mealMessage, setMealMessage] = useState<Message | null>(null);
  const [workoutMessage, setWorkoutMessage] = useState<Message | null>(null);

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

  useEffect(() => {
    const restoredSession = readJson<LocalSession | null>(storageKeys.session, null);
    const restoredMeals = readJson<MealLog[]>(storageKeys.meals, []);
    const restoredWorkouts = readJson<WorkoutLog[]>(storageKeys.workouts, []);
    const restoredGoals = readJson<Goal[]>(storageKeys.goals, []);
    const restoredMetrics = readJson<BodyMetric[]>(storageKeys.metrics, []);

    setSession(restoredSession);
    setAllMeals(restoredMeals);
    setAllWorkouts(restoredWorkouts);
    setAllGoals(restoredGoals);
    if (restoredMetrics.length > 0) {
      // 체성분 로컬 저장 확장을 대비해 키를 미리 유지한다.
      writeJson(storageKeys.metrics, restoredMetrics);
    }
  }, []);

  const userMeals = useMemo(() => {
    if (!session) {
      return [];
    }
    return allMeals.filter((item) => item.userId === session.userId);
  }, [allMeals, session]);

  const userWorkouts = useMemo(() => {
    if (!session) {
      return [];
    }
    return allWorkouts.filter((item) => item.userId === session.userId);
  }, [allWorkouts, session]);

  const userGoals = useMemo(() => {
    if (!session) {
      return [];
    }
    return allGoals.filter((item) => item.userId === session.userId);
  }, [allGoals, session]);

  const currentGoal = useMemo(() => {
    const sorted = [...userGoals].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return sorted[0] ?? null;
  }, [userGoals]);

  useEffect(() => {
    if (!currentGoal) {
      return;
    }
    setGoalForm({
      weeklyRoutineTarget: String(currentGoal.weeklyRoutineTarget),
      dDay: currentGoal.dDay ?? "",
      targetWeightKg: currentGoal.targetWeightKg?.toString() ?? "",
      targetBodyFat: currentGoal.targetBodyFat?.toString() ?? ""
    });
  }, [currentGoal?.id, currentGoal?.createdAt]);

  const dashboard = useMemo(() => {
    if (!session) {
      return null;
    }
    return aggregateDashboard({
      range,
      meals: userMeals,
      workouts: userWorkouts,
      bodyMetrics: allMetrics.filter((item) => item.userId === session.userId),
      goals: userGoals,
      now: new Date()
    });
  }, [allMetrics, range, session, userGoals, userMeals, userWorkouts]);

  const exerciseSuggestions = useMemo(() => {
    return exerciseCandidates[workoutForm.bodyPart];
  }, [workoutForm.bodyPart]);

  function createGuestSession() {
    const nextSession: LocalSession = {
      sessionId: createId("sess"),
      userId: createId("user"),
      createdAt: nowIso()
    };
    writeJson(storageKeys.session, nextSession);
    setSession(nextSession);
    setSessionMessage({ type: "success", text: "게스트 세션이 시작되었습니다. 기록은 브라우저에 저장됩니다." });
    setGoalMessage(null);
    setMealMessage(null);
    setWorkoutMessage(null);
    setMealForm((prev) => ({ ...prev, date: todayYmd(), foodLabel: "" }));
    setWorkoutForm((prev) => ({ ...prev, date: todayYmd(), exerciseName: "" }));
  }

  function copyMealFromDate(date: string, label: string) {
    if (!session) {
      setMealMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    const byDate = userMeals
      .filter((item) => item.date.slice(0, 10) === date)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const latest = byDate[0];
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
    setMealMessage({ type: "success", text: `${label} 기록을 폼에 복사했습니다.` });
  }

  function copyMostRecentMeal() {
    if (!session) {
      setMealMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    for (let i = 1; i <= recentSearchLimit; i++) {
      const date = ymdOffset(-i);
      const byDate = userMeals
        .filter((item) => item.date.slice(0, 10) === date)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const latest = byDate[0];
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

  function saveGoal() {
    if (!session) {
      setGoalMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }

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
    if (goalForm.dDay.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(goalForm.dDay.trim())) {
      setGoalMessage({ type: "error", text: "D-day는 YYYY-MM-DD 형식으로 입력해 주세요." });
      return;
    }

    const base: Goal = {
      id: currentGoal?.id ?? createId("goal"),
      userId: session.userId,
      weeklyRoutineTarget,
      createdAt: currentGoal?.createdAt ?? nowIso()
    };
    if (goalForm.dDay.trim()) {
      base.dDay = goalForm.dDay.trim();
    }
    if (targetWeightKg !== undefined) {
      base.targetWeightKg = targetWeightKg;
    }
    if (targetBodyFat !== undefined) {
      base.targetBodyFat = targetBodyFat;
    }

    setAllGoals((prev) => {
      const index = prev.findIndex((item) => item.userId === session.userId);
      const next = [...prev];
      if (index >= 0) {
        next[index] = base;
      } else {
        next.push(base);
      }
      writeJson(storageKeys.goals, next);
      return next;
    });
    setGoalMessage({ type: "success", text: "목표를 저장했습니다." });
  }

  function saveMealLog() {
    if (!session) {
      setMealMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    const foodLabel = mealForm.foodLabel.trim();
    if (!foodLabel) {
      setMealMessage({ type: "error", text: "음식명을 입력해 주세요." });
      return;
    }
    const mealLog: MealLog = {
      id: createId("meal"),
      userId: session.userId,
      date: mealForm.date,
      mealType: mealForm.mealType,
      foodLabel,
      portionSize: mealForm.portionSize,
      createdAt: nowIso()
    };
    setAllMeals((prev) => {
      const next = [mealLog, ...prev];
      writeJson(storageKeys.meals, next);
      return next;
    });
    setMealForm((prev) => ({ ...prev, foodLabel: "" }));
    setMealMessage({ type: "success", text: "식단을 저장했습니다." });
  }

  function saveWorkoutLog() {
    if (!session) {
      setWorkoutMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    const durationMinutes = parseInteger(workoutForm.durationMinutes);
    if (durationMinutes === undefined || durationMinutes < 1 || durationMinutes > 300) {
      setWorkoutMessage({ type: "error", text: "운동 시간은 1~300분 범위로 입력해 주세요." });
      return;
    }

    const fallbackExercise = exerciseSuggestions[0] ?? "기본 운동";
    const exerciseName = workoutForm.exerciseName.trim() || fallbackExercise;

    const workoutLog: WorkoutLog = {
      id: createId("workout"),
      userId: session.userId,
      date: workoutForm.date,
      bodyPart: workoutForm.bodyPart,
      purpose: workoutForm.purpose,
      tool: workoutForm.tool,
      exerciseName,
      durationMinutes,
      intensity: workoutForm.intensity,
      createdAt: nowIso()
    };

    setAllWorkouts((prev) => {
      const next = [workoutLog, ...prev];
      writeJson(storageKeys.workouts, next);
      return next;
    });

    setWorkoutForm((prev) => ({
      ...prev,
      exerciseName: "",
      durationMinutes: prev.durationMinutes || "30"
    }));
    setWorkoutMessage({ type: "success", text: `${exerciseName} 운동을 저장했습니다.` });
  }

  const goalProgress = dashboard?.goals?.[0];
  const adherenceLabel = dashboard ? formatPercent(dashboard.adherenceRate) : "--";
  const mealSummary = dashboard ? `${dashboard.totalMeals}건` : "--";
  const workoutSummary = dashboard ? `${dashboard.totalWorkouts}건` : "--";
  const statusLabel = goalProgress
    ? `${goalProgress.completedRoutineCount}회 완료 / 주간 목표 ${goalProgress.weeklyRoutineTarget}회`
    : "목표가 아직 없습니다.";

  return (
    <main className="layout">
      <section className="hero">
        <div>
          <p className="eyebrow">RoutineMate MVP</p>
          <h1>루틴 메이트로 빠르게 기록하고, 가독성 있게 복기한다.</h1>
          <p className="subtext">배포 환경에서도 끊기지 않도록 브라우저 로컬 저장으로 즉시 기록합니다.</p>
        </div>
        <div className="actions">
          <button type="button" className="button button-primary button-reset" onClick={createGuestSession}>
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
        <p className="hint">{statusLabel}</p>
      </section>

      <section className="split-grid">
        <article className="card">
          <h2>목표 설정</h2>
          <p className="hint">주간 루틴, 체중, 체지방 목표를 한 번에 저장합니다.</p>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              saveGoal();
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
            <button type="submit" className="button button-primary button-reset full-span">
              목표 저장
            </button>
          </form>
          {goalMessage ? <p className={`status status-${goalMessage.type}`}>{goalMessage.text}</p> : null}
        </article>

        <article className="card">
          <h2>식단 Quick Log</h2>
          <p className="hint">어제/최근 기록을 바로 복사해서 빠르게 저장할 수 있습니다.</p>
          <div className="inline-actions">
            <button type="button" className="button" disabled={!session} onClick={() => copyMealFromDate(ymdOffset(-1), "어제")}>
              어제 기록 복사
            </button>
            <button type="button" className="button" disabled={!session} onClick={copyMostRecentMeal}>
              최근 기록 복사
            </button>
          </div>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              saveMealLog();
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
            <button type="submit" className="button button-primary button-reset full-span">
              식단 저장
            </button>
          </form>
          {mealMessage ? <p className={`status status-${mealMessage.type}`}>{mealMessage.text}</p> : null}
        </article>
      </section>

      <section className="card">
        <h2>운동 Quick Log</h2>
        <p className="hint">운동명이 헷갈리면 부위/목적/도구를 먼저 고르고 추천 운동을 눌러 바로 저장하세요.</p>
        <div className="recommend-row">
          {exerciseSuggestions.map((name) => (
            <button
              key={name}
              type="button"
              className="recommend-chip"
              onClick={() => setWorkoutForm((prev) => ({ ...prev, exerciseName: name }))}
            >
              {name}
            </button>
          ))}
        </div>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            saveWorkoutLog();
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
            <span>운동 부위</span>
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
              placeholder="운동명을 모르면 위 추천 버튼 사용"
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
      </section>
    </main>
  );
}
