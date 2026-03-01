import { StatusBar } from "expo-status-bar";
import * as AuthSession from "expo-auth-session";
import * as Notifications from "expo-notifications";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions
} from "react-native";
import * as React from "react";
import { cardRadius, colors, spacing } from "@routinemate/ui";

type TabKey = "dashboard" | "records" | "settings";

type Session = {
  sessionId: string;
  userId: string;
  isGuest: boolean;
  email?: string;
  authProvider?: string;
};

type Dashboard = {
  adherenceRate: number;
  totalMeals: number;
  totalWorkouts: number;
  range: string;
  granularity: string;
  latestWeightKg?: number | null;
  latestBodyFatPct?: number | null;
};

type Goal = {
  weeklyRoutineTarget: number;
  targetWeightKg?: number;
  targetBodyFat?: number;
  dDay?: string;
};

type ReminderSettings = {
  isEnabled: boolean;
  dailyReminderTime: string;
  missingLogReminderTime: string;
  channels: string[];
  timezone: string;
};

type MealSlot = "breakfast" | "lunch" | "dinner" | "dinner2";

type MealTemplate = {
  id: string;
  label: string;
  mealSlot: MealSlot;
  isActive: boolean;
};

type BodyPart = "chest" | "back" | "legs" | "core" | "shoulders" | "arms" | "full_body" | "cardio";
type WorkoutPurpose = "muscle_gain" | "fat_loss" | "endurance" | "mobility" | "recovery";
type WorkoutTool = "bodyweight" | "dumbbell" | "machine" | "barbell" | "kettlebell" | "mixed";
type WorkoutIntensity = "low" | "medium" | "high";

type WorkoutTemplate = {
  id: string;
  label: string;
  bodyPart: BodyPart;
  purpose: WorkoutPurpose;
  tool: WorkoutTool;
  defaultDuration?: number;
  isActive: boolean;
};

type MealCheckin = {
  id: string;
  date: string;
  slot: MealSlot;
  completed: boolean;
  templateId?: string;
  isDeleted?: boolean;
};

type WorkoutLog = {
  id: string;
  date: string;
  bodyPart: BodyPart;
  purpose: WorkoutPurpose;
  tool: WorkoutTool;
  exerciseName: string;
  durationMinutes?: number;
  intensity?: WorkoutIntensity;
  templateId?: string;
  isDeleted?: boolean;
};

type BodyMetric = {
  id: string;
  date: string;
  weightKg?: number;
  bodyFatPct?: number;
  isDeleted?: boolean;
};

type DaySnapshot = {
  date: string;
  mealCheckins: MealCheckin[];
  workoutLogs: WorkoutLog[];
  bodyMetrics: BodyMetric[];
};

type WorkoutLogInput = {
  date: string;
  bodyPart: BodyPart;
  purpose: WorkoutPurpose;
  tool: WorkoutTool;
  exerciseName: string;
  intensity: WorkoutIntensity;
  durationMinutes: string;
  templateId?: string;
};

type MessageType = "error" | "success" | "info";
type Message = {
  type: MessageType;
  text: string;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://routinemate-kohl.vercel.app";
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";

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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = (await response.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "요청에 실패했습니다.");
  }
  return payload?.data as T;
}

function todayYmd(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed.length) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function defaultDay(date: string): DaySnapshot {
  return {
    date,
    mealCheckins: [],
    workoutLogs: [],
    bodyMetrics: []
  };
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("ko-KR");
}

function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} />
    </View>
  );
}

function SelectRow({
  label,
  options,
  selected,
  onSelect
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRowWrap}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.chip, selected === option.value && styles.chipActive]}
            onPress={() => onSelect(option.value)}
          >
            <Text style={styles.chipText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function App(): React.JSX.Element {
  const [tab, setTab] = React.useState<TabKey>("dashboard");
  const [session, setSession] = React.useState<Session | null>(null);
  const [message, setMessage] = React.useState<Message | null>(null);

  const [range, setRange] = React.useState<"7d" | "30d" | "90d">("7d");
  const [dashboard, setDashboard] = React.useState<Dashboard | null>(null);
  const [goal, setGoal] = React.useState<Goal | null>(null);
  const today = React.useMemo(() => todayYmd(), []);
  const [selectedDate, setSelectedDate] = React.useState(today);
  const [day, setDay] = React.useState<DaySnapshot>(defaultDay(today));

  const [mealTemplates, setMealTemplates] = React.useState<MealTemplate[]>([]);
  const [workoutTemplates, setWorkoutTemplates] = React.useState<WorkoutTemplate[]>([]);

  const [mealTemplateLabel, setMealTemplateLabel] = React.useState("");
  const [mealTemplateSlot, setMealTemplateSlot] = React.useState<MealSlot>("lunch");

  const [workoutTemplateLabel, setWorkoutTemplateLabel] = React.useState("");
  const [workoutTemplateBodyPart, setWorkoutTemplateBodyPart] = React.useState<BodyPart>("full_body");
  const [workoutTemplatePurpose, setWorkoutTemplatePurpose] = React.useState<WorkoutPurpose>("fat_loss");
  const [workoutTemplateTool, setWorkoutTemplateTool] = React.useState<WorkoutTool>("bodyweight");
  const [workoutTemplateDuration, setWorkoutTemplateDuration] = React.useState("30");

  const [workoutForm, setWorkoutForm] = React.useState<WorkoutLogInput>({
    date: today,
    bodyPart: "full_body",
    purpose: "fat_loss",
    tool: "bodyweight",
    exerciseName: "",
    intensity: "medium",
    durationMinutes: "30",
    templateId: ""
  });

  const [weightForm, setWeightForm] = React.useState("");
  const [bodyFatForm, setBodyFatForm] = React.useState("");
  const [bodyMetricDate, setBodyMetricDate] = React.useState(today);

  const [goalTarget, setGoalTarget] = React.useState("4");
  const [goalWeight, setGoalWeight] = React.useState("");
  const [goalFat, setGoalFat] = React.useState("");
  const [goalDday, setGoalDday] = React.useState("");

  const [reminder, setReminder] = React.useState<ReminderSettings>({
    isEnabled: true,
    dailyReminderTime: "20:00",
    missingLogReminderTime: "21:30",
    channels: ["web_in_app", "mobile_local"],
    timezone: "Asia/Seoul"
  });

  const checkinBySlot = React.useMemo(() => {
    const map = new Map<MealSlot, MealCheckin>();
    for (const item of day.mealCheckins) {
      if (item.isDeleted) {
        continue;
      }
      if (!map.get(item.slot) || item.date > map.get(item.slot)!.date) {
        map.set(item.slot, item);
      }
    }
    return map;
  }, [day.mealCheckins]);

  const activeMealTemplates = React.useMemo(() => mealTemplates.filter((item) => item.isActive), [mealTemplates]);
  const activeWorkoutTemplates = React.useMemo(() => workoutTemplates.filter((item) => item.isActive), [workoutTemplates]);

  const messageTextStyle = React.useMemo(() => {
    if (!message) {
      return styles.info;
    }
    if (message.type === "error") {
      return styles.messageError;
    }
    if (message.type === "info") {
      return styles.messageInfo;
    }
    return styles.messageSuccess;
  }, [message]);

  const loadSessionData = React.useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const [dashboardData, goalData, dayData, mealTemplatesData, workoutTemplatesData] = await Promise.all([
        apiFetch<Dashboard>(`/api/v1/dashboard?sessionId=${encodeURIComponent(session.sessionId)}&range=${range}`),
        apiFetch<{ goal: Goal | null }>(`/api/v1/goals?sessionId=${encodeURIComponent(session.sessionId)}`),
        apiFetch<DaySnapshot>(`/api/v1/calendar/day?sessionId=${encodeURIComponent(session.sessionId)}&date=${encodeURIComponent(selectedDate)}`),
        apiFetch<{ templates: MealTemplate[] }>(`/api/v1/templates/meals?sessionId=${encodeURIComponent(session.sessionId)}`),
        apiFetch<{ templates: WorkoutTemplate[] }>(`/api/v1/templates/workouts?sessionId=${encodeURIComponent(session.sessionId)}`)
      ]);

      setDashboard(dashboardData ?? null);
      setGoal(goalData?.goal ?? null);
      setDay(dayData ?? defaultDay(selectedDate));
      setMealTemplates(mealTemplatesData.templates ?? []);
      setWorkoutTemplates(workoutTemplatesData.templates ?? []);

      setGoalTarget(String(goalData?.goal?.weeklyRoutineTarget ?? 4));
      setGoalWeight(goalData?.goal?.targetWeightKg?.toString() ?? "");
      setGoalFat(goalData?.goal?.targetBodyFat?.toString() ?? "");
      setGoalDday(goalData?.goal?.dDay ?? "");

      setMealTemplateLabel("");
      setWorkoutTemplateLabel("");
      setMessage({ type: "info", text: "데이터를 불러왔습니다." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "조회에 실패했습니다." });
    }
  }, [range, session, selectedDate]);

  React.useEffect(() => {
    void loadSessionData();
  }, [loadSessionData]);

  const startGuest = React.useCallback(async () => {
    try {
      const next = await apiFetch<Session>("/api/v1/auth/guest", {
        method: "POST",
        body: JSON.stringify({})
      });
      setSession(next);
      setMessage({ type: "success", text: "게스트 세션을 시작했습니다." });
      setSelectedDate(today);
      setWorkoutForm((prev) => ({ ...prev, date: today }));
      setBodyMetricDate(today);
      await loadSessionData();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "게스트 시작 실패" });
    }
  }, [loadSessionData, today]);

  const upsertMealCheckin = React.useCallback(
    async (slot: MealSlot, completed: boolean, templateId?: string) => {
      if (!session) {
        setMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
        return;
      }

      const existing = checkinBySlot.get(slot);
      const payload = {
        sessionId: session.sessionId,
        date: selectedDate,
        slot,
        completed,
        ...(templateId ? { templateId } : {})
      };

      const previousDay = day;
      const optimistic: MealCheckin = {
        id: existing?.id ?? `tmp-meal-${Date.now()}`,
        date: selectedDate,
        slot,
        completed,
        ...(templateId !== undefined ? { templateId } : {})
      };

      setDay((current) => ({
        ...current,
        mealCheckins: existing
          ? current.mealCheckins.map((item) => (item.id === existing.id ? { ...item, ...optimistic } : item))
          : [...current.mealCheckins, optimistic]
      }));

      try {
        const response = await (existing
          ? apiFetch<MealCheckin>(`/api/v1/meal-checkins/${existing.id}`, {
              method: "PATCH",
              body: JSON.stringify(payload)
            })
          : apiFetch<MealCheckin>("/api/v1/meal-checkins", {
              method: "POST",
              body: JSON.stringify(payload)
            }));

        if (response?.id) {
          setDay((current) => ({
            ...current,
            mealCheckins: [...current.mealCheckins.filter((item) => item.id !== optimistic.id), response]
          }));
        }
        setMessage({ type: "success", text: `${mealSlots.find((item) => item.value === slot)?.label ?? "식단"} 체크인을 저장했습니다.` });
      } catch (error) {
        setDay(previousDay);
        setMessage({ type: "error", text: error instanceof Error ? error.message : "식단 저장 실패" });
      }
      await loadSessionData();
    },
    [checkinBySlot, day, loadSessionData, selectedDate, session]
  );

  const saveWorkoutLog = React.useCallback(
    async (source?: WorkoutTemplate) => {
      if (!session) {
        setMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
        return;
      }

      const template = source;
      const payload = {
        sessionId: session.sessionId,
        date: template ? selectedDate : workoutForm.date,
        bodyPart: template ? template.bodyPart : workoutForm.bodyPart,
        purpose: template ? template.purpose : workoutForm.purpose,
        tool: template ? template.tool : workoutForm.tool,
        exerciseName: template ? template.label : workoutForm.exerciseName || "기본 운동",
        intensity: template ? "medium" : workoutForm.intensity,
        durationMinutes: template
          ? template.defaultDuration ?? 30
          : parseNumber(workoutForm.durationMinutes) ?? parseNumber("30") ?? 30,
        ...(template && template.id ? { templateId: template.id } : {})
      };

      const optimistic: WorkoutLog = {
        id: `tmp-workout-${Date.now()}`,
        date: payload.date,
        bodyPart: payload.bodyPart,
        purpose: payload.purpose,
        tool: payload.tool,
        exerciseName: payload.exerciseName,
        intensity: payload.intensity,
        durationMinutes: payload.durationMinutes,
        ...(payload.templateId ? { templateId: payload.templateId } : {})
      };

      const previousDay = day;
      setDay((current) => ({ ...current, workoutLogs: [optimistic, ...current.workoutLogs] }));

      try {
        const saved = await apiFetch<WorkoutLog>("/api/v1/workout-logs/quick", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        if (saved?.id) {
          setDay((current) => ({
            ...current,
            workoutLogs: [saved, ...current.workoutLogs.filter((item) => !item.id.startsWith("tmp-workout-") && item.id !== saved.id)]
          }));
        }
        if (!template) {
          setWorkoutForm((prev) => ({ ...prev, exerciseName: "" }));
        }
        setMessage({ type: "success", text: "운동을 저장했습니다." });
      } catch (error) {
        setDay(previousDay);
        setMessage({ type: "error", text: error instanceof Error ? error.message : "운동 저장 실패" });
      }
      await loadSessionData();
    },
    [day, loadSessionData, selectedDate, session, workoutForm]
  );

  const saveBodyMetric = React.useCallback(async () => {
    if (!session) {
      setMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }

    const weightKg = parseNumber(weightForm);
    const bodyFatPct = parseNumber(bodyFatForm);
    if (weightKg === undefined && bodyFatPct === undefined) {
      setMessage({ type: "error", text: "체중 또는 체지방 중 하나를 입력해 주세요." });
      return;
    }

    const payload = {
      sessionId: session.sessionId,
      date: bodyMetricDate,
      ...(weightKg !== undefined ? { weightKg } : {}),
      ...(bodyFatPct !== undefined ? { bodyFatPct } : {})
    };

    const previousDay = day;
    const optimistic: BodyMetric = {
      id: `tmp-body-${Date.now()}`,
      date: bodyMetricDate,
      ...(weightKg !== undefined ? { weightKg } : {}),
      ...(bodyFatPct !== undefined ? { bodyFatPct } : {})
    };

    setDay((current) => ({ ...current, bodyMetrics: [optimistic, ...current.bodyMetrics] }));

    try {
      await apiFetch<BodyMetric>("/api/v1/body-metrics", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setMessage({ type: "success", text: "체성분을 저장했습니다." });
      setWeightForm("");
      setBodyFatForm("");
    } catch (error) {
      setDay(previousDay);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "체성분 저장 실패" });
    }
    await loadSessionData();
  }, [bodyFatForm, bodyMetricDate, day, loadSessionData, session, weightForm]);

  const saveGoal = React.useCallback(async () => {
    if (!session) {
      setMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }

    const weeklyRoutineTarget = parseNumber(goalTarget);
    if (!weeklyRoutineTarget || weeklyRoutineTarget < 1 || weeklyRoutineTarget > 30) {
      setMessage({ type: "error", text: "주간 루틴 목표는 1~30 범위여야 합니다." });
      return;
    }

    const payload = {
      sessionId: session.sessionId,
      weeklyRoutineTarget: Math.trunc(weeklyRoutineTarget),
      ...(goalWeight.trim() ? { targetWeightKg: parseNumber(goalWeight) } : {}),
      ...(goalFat.trim() ? { targetBodyFat: parseNumber(goalFat) } : {}),
      ...(goalDday.trim() ? { dDay: goalDday.trim() } : {})
    };

    try {
      const next = await apiFetch<Goal>("/api/v1/goals", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setGoal(next);
      setMessage({ type: "success", text: "목표를 저장했습니다." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "목표 저장 실패" });
    }
    await loadSessionData();
  }, [goalDday, goalFat, goalTarget, goalWeight, loadSessionData, session]);

  const createMealTemplate = React.useCallback(async () => {
    if (!session) {
      setMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    const trimmed = mealTemplateLabel.trim();
    if (!trimmed.length) {
      setMessage({ type: "error", text: "식단 템플릿 이름을 입력해 주세요." });
      return;
    }

    const newTemplate: MealTemplate = {
      id: `tmp-meal-template-${Date.now()}`,
      label: trimmed,
      mealSlot: mealTemplateSlot,
      isActive: true
    };

    const previous = mealTemplates;
    setMealTemplates((current) => [newTemplate, ...current]);
    setMealTemplateLabel("");

    try {
      const saved = await apiFetch<MealTemplate>("/api/v1/templates/meals", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.sessionId,
          label: trimmed,
          mealSlot: mealTemplateSlot,
          isActive: true
        })
      });
      if (saved?.id) {
        setMealTemplates((current) => [saved, ...current.filter((item) => item.id !== newTemplate.id)]);
      }
      setMessage({ type: "success", text: "식단 템플릿을 저장했습니다." });
    } catch (error) {
      setMealTemplates(previous);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "식단 템플릿 저장 실패" });
    }
  }, [mealTemplateLabel, mealTemplateSlot, mealTemplates, session]);

  const createWorkoutTemplate = React.useCallback(async () => {
    if (!session) {
      setMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }
    const trimmed = workoutTemplateLabel.trim();
    if (!trimmed.length) {
      setMessage({ type: "error", text: "운동 템플릿 이름을 입력해 주세요." });
      return;
    }
    const defaultDuration = parseNumber(workoutTemplateDuration) ?? 30;

    const newTemplate: WorkoutTemplate = {
      id: `tmp-workout-template-${Date.now()}`,
      label: trimmed,
      bodyPart: workoutTemplateBodyPart,
      purpose: workoutTemplatePurpose,
      tool: workoutTemplateTool,
      defaultDuration,
      isActive: true
    };

    const previous = workoutTemplates;
    setWorkoutTemplates((current) => [newTemplate, ...current]);
    setWorkoutTemplateLabel("");

    try {
      const saved = await apiFetch<WorkoutTemplate>("/api/v1/templates/workouts", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.sessionId,
          label: trimmed,
          bodyPart: workoutTemplateBodyPart,
          purpose: workoutTemplatePurpose,
          tool: workoutTemplateTool,
          defaultDuration,
          isActive: true
        })
      });
      if (saved?.id) {
        setWorkoutTemplates((current) => [saved, ...current.filter((item) => item.id !== newTemplate.id)]);
      }
      setMessage({ type: "success", text: "운동 템플릿을 저장했습니다." });
    } catch (error) {
      setWorkoutTemplates(previous);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "운동 템플릿 저장 실패" });
    }
  }, [workoutTemplateBodyPart, workoutTemplateDuration, workoutTemplateLabel, workoutTemplatePurpose, workoutTemplateTool, session, workoutTemplates]);

  const saveReminder = React.useCallback(async () => {
    if (!session) {
      setMessage({ type: "error", text: "먼저 세션을 시작해 주세요." });
      return;
    }

    try {
      await apiFetch<{ reminder: ReminderSettings }>("/api/v1/reminders/settings", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.sessionId,
          isEnabled: reminder.isEnabled,
          dailyReminderTime: reminder.dailyReminderTime,
          missingLogReminderTime: reminder.missingLogReminderTime,
          channels: reminder.channels,
          timezone: reminder.timezone
        })
      });
      await Notifications.requestPermissionsAsync();
      if (reminder.channels.includes("mobile_local")) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "RoutineMate 리마인더",
            body: "오늘 루틴을 기록해 주세요."
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 0 }
        });
      }
      setMessage({ type: "success", text: "리마인더 설정을 저장했습니다." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "리마인더 저장 실패" });
    }
  }, [reminder, session]);

  const upgradeGoogleMobile = React.useCallback(async () => {
    try {
      if (!GOOGLE_ANDROID_CLIENT_ID) {
        setMessage({ type: "error", text: "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID가 필요합니다." });
        return;
      }
      const redirectUri = AuthSession.makeRedirectUri();
      const nonce = String(Date.now());
      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_ANDROID_CLIENT_ID,
        responseType: AuthSession.ResponseType.IdToken,
        scopes: ["openid", "email", "profile"],
        redirectUri,
        extraParams: { nonce }
      });

      const authResult = await request.promptAsync({
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth"
      });

      if (authResult.type !== "success" || !authResult.params?.id_token) {
        setMessage({ type: "error", text: "Google 인증이 취소되었거나 실패했습니다." });
        return;
      }

      const payload = await apiFetch<Session>(session ? "/api/v1/auth/upgrade/google" : "/api/v1/auth/google/session", {
        method: "POST",
        body: JSON.stringify({
          ...(session ? { sessionId: session.sessionId } : {}),
          idToken: authResult.params.id_token,
          platform: "android"
        })
      });
      setSession(payload);
      setMessage({ type: "success", text: "Google 계정 전환이 완료되었습니다." });
      await loadSessionData();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Google 전환 실패" });
    }
  }, [loadSessionData, session]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Text style={styles.brand}>RoutineMate</Text>
        <Pressable style={styles.primaryButton} onPress={startGuest}>
          <Text style={styles.primaryButtonText}>게스트 시작</Text>
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        {([
          ["dashboard", "대시보드"],
          ["records", "기록"],
          ["settings", "설정"]
        ] as Array<[TabKey, string]>).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.tabButton, tab === key && styles.tabButtonActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={messageTextStyle}>{message?.text ?? ""}</Text>
        <Text style={styles.hint}>세션: {session ? `${session.sessionId.slice(0, 10)}...` : "없음"}</Text>

        {tab === "dashboard" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>대시보드</Text>
            <View style={styles.tabRow}>
              <Pressable style={styles.chip} onPress={() => setRange("7d")}>
                <Text style={styles.chipText}>Day</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => setRange("30d")}>
                <Text style={styles.chipText}>Week</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => setRange("90d")}>
                <Text style={styles.chipText}>Month</Text>
              </Pressable>
            </View>
            <Text style={styles.value}>체크인율 {Math.round(dashboard?.adherenceRate ?? 0)}%</Text>
            <Text style={styles.hint}>식단 {dashboard?.totalMeals ?? 0}건 / 운동 {dashboard?.totalWorkouts ?? 0}건</Text>
            {goal ? <Text style={styles.hint}>현재 목표: 주 {goal.weeklyRoutineTarget}회</Text> : <Text style={styles.hint}>현재 목표: 미설정</Text>}
            <Text style={styles.hint}>최근 체중 {dashboard?.latestWeightKg ?? "-"}kg / 체지방 {dashboard?.latestBodyFatPct ?? "-"}%</Text>
          </View>
        ) : null}

        {tab === "records" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>기록</Text>
            <Text style={styles.hint}>식단 체크인</Text>

            {mealSlots.map((slot) => {
              const current = checkinBySlot.get(slot.value);
              const completed = current?.completed ?? false;
              const templates = activeMealTemplates.filter((template) => template.mealSlot === slot.value);
              return (
            <View style={styles.subCard} key={slot.value}>
                  <Text style={styles.sectionSubTitle}>{slot.label}</Text>
                  <View style={styles.row}>
                    <Pressable
                      style={[styles.chip, completed && styles.chipActive]}
                      onPress={() => {
                        void upsertMealCheckin(slot.value, true, current?.templateId);
                      }}
                    >
                      <Text style={styles.chipText}>함</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.chip, !completed && current && !current.isDeleted && styles.chipActive]}
                      onPress={() => {
                        void upsertMealCheckin(slot.value, false);
                      }}
                    >
                      <Text style={styles.chipText}>안함</Text>
                    </Pressable>
                  </View>
                  <View style={styles.chipRowWrap}>
                    {templates.length > 0 ? (
                      templates.map((template) => (
                        <Pressable
                          key={template.id}
                          style={[styles.chip, current?.templateId === template.id && styles.chipActive]}
                          onPress={() => void upsertMealCheckin(slot.value, true, template.id)}
                        >
                          <Text style={styles.chipText}>{template.label}</Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.hint}>이 슬롯 템플릿 등록 시 1탭 체크가 가능합니다.</Text>
                    )}
                  </View>
                  <View style={styles.actionGap} />
                </View>
              );
            })}

            <Text style={styles.sectionTitle}>운동 Quick Log</Text>
            {activeWorkoutTemplates.length > 0 ? (
              <>
                <Text style={styles.hint}>템플릿 빠른 저장</Text>
                <View style={styles.chipRowWrap}>
                  {activeWorkoutTemplates.map((template) => (
                    <Pressable key={template.id} style={styles.chip} onPress={() => void saveWorkoutLog(template)}>
                      <Text style={styles.chipText}>{template.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.hint}>설정에서 운동 템플릿을 등록하면 1탭 저장이 가능합니다.</Text>
            )}

            <View style={styles.form}>
            <FieldInput
              label="날짜"
              value={workoutForm.date}
              onChangeText={(date) => setWorkoutForm((prev) => ({ ...prev, date }))}
              placeholder="YYYY-MM-DD"
            />
            <SelectRow
              label="부위"
              options={bodyPartOptions.map((item) => ({ value: item.value, label: item.label }))}
              selected={workoutForm.bodyPart}
              onSelect={(value) => setWorkoutForm((prev) => ({ ...prev, bodyPart: value as BodyPart, templateId: "" }))}
            />
            <SelectRow
              label="목적"
              options={purposeOptions.map((item) => ({ value: item.value, label: item.label }))}
              selected={workoutForm.purpose}
              onSelect={(value) => setWorkoutForm((prev) => ({ ...prev, purpose: value as WorkoutPurpose, templateId: "" }))}
            />
            <SelectRow
              label="도구"
              options={toolOptions.map((item) => ({ value: item.value, label: item.label }))}
              selected={workoutForm.tool}
              onSelect={(value) => setWorkoutForm((prev) => ({ ...prev, tool: value as WorkoutTool, templateId: "" }))}
            />
            <FieldInput
              label="운동명"
              value={workoutForm.exerciseName}
              onChangeText={(exerciseName) => setWorkoutForm((prev) => ({ ...prev, exerciseName, templateId: "" }))}
              placeholder="운동명 입력"
            />
            <SelectRow
              label="강도"
              options={intensityOptions.map((item) => ({ value: item.value, label: item.label }))}
              selected={workoutForm.intensity}
              onSelect={(value) => setWorkoutForm((prev) => ({ ...prev, intensity: value as WorkoutIntensity, templateId: "" }))}
            />
            <FieldInput
              label="시간(분)"
              value={workoutForm.durationMinutes}
              onChangeText={(durationMinutes) => setWorkoutForm((prev) => ({ ...prev, durationMinutes, templateId: "" }))}
              placeholder="30"
              keyboardType="numeric"
            />

            <Pressable style={[styles.primaryButton, styles.actionGap]} onPress={() => void saveWorkoutLog()}>
              <Text style={styles.primaryButtonText}>운동 저장</Text>
            </Pressable>

            </View>

            <Text style={styles.sectionTitle}>체중/체지방 기록</Text>
            <FieldInput
              label="날짜"
              value={bodyMetricDate}
              onChangeText={setBodyMetricDate}
              placeholder="YYYY-MM-DD"
            />
            <FieldInput
              label="체중(kg)"
              value={weightForm}
              onChangeText={setWeightForm}
              placeholder="예: 70.0"
              keyboardType="numeric"
            />
            <FieldInput
              label="체지방(%)"
              value={bodyFatForm}
              onChangeText={setBodyFatForm}
              placeholder="예: 18.5"
              keyboardType="numeric"
            />
            <Pressable style={[styles.primaryButton, styles.actionGap]} onPress={saveBodyMetric}>
              <Text style={styles.primaryButtonText}>체성분 저장</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "settings" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>설정</Text>

            <Text style={styles.sectionTitle}>목표</Text>
            <FieldInput
              label="주간 목표"
              value={goalTarget}
              onChangeText={setGoalTarget}
              placeholder="예: 4"
              keyboardType="numeric"
            />
            <FieldInput
              label="목표 체중"
              value={goalWeight}
              onChangeText={setGoalWeight}
              placeholder="목표 체중(kg)"
              keyboardType="numeric"
            />
            <FieldInput
              label="목표 체지방"
              value={goalFat}
              onChangeText={setGoalFat}
              placeholder="목표 체지방(%)"
              keyboardType="numeric"
            />
            <FieldInput
              label="D-Day"
              value={goalDday}
              onChangeText={setGoalDday}
              placeholder="YYYY-MM-DD"
            />
            <Pressable style={[styles.primaryButton, styles.actionGap]} onPress={saveGoal}>
              <Text style={styles.primaryButtonText}>목표 저장</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>식단 템플릿</Text>
            <FieldInput
              label="템플릿 이름"
              value={mealTemplateLabel}
              onChangeText={setMealTemplateLabel}
              placeholder="아침 식사 템플릿"
            />
            <SelectRow
              label="슬롯"
              options={mealSlots.map((item) => ({ value: item.value, label: item.label }))}
              selected={mealTemplateSlot}
              onSelect={(value) => setMealTemplateSlot(value as MealSlot)}
            />
            <Pressable style={[styles.primaryButton, styles.actionGap]} onPress={createMealTemplate}>
              <Text style={styles.primaryButtonText}>식단 템플릿 추가</Text>
            </Pressable>

            <Text style={styles.hint}>등록된 식단 템플릿</Text>
            <View style={styles.chipRowWrap}>
              {mealTemplates.length === 0 ? <Text style={styles.hint}>등록된 템플릿이 없습니다.</Text> : null}
              {mealTemplates.map((template) => (
                <View key={template.id} style={styles.pillRow}>
                  <Text style={styles.pillLabel}>
                    {template.label} ({mealSlots.find((slot) => slot.value === template.mealSlot)?.label})
                  </Text>
                  <Text style={styles.hint}>{template.isActive ? "ON" : "OFF"}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>운동 템플릿</Text>
            <FieldInput
              label="템플릿 이름"
              value={workoutTemplateLabel}
              onChangeText={setWorkoutTemplateLabel}
              placeholder="런지 세트"
            />
            <SelectRow
              label="부위"
              options={bodyPartOptions.map((item) => ({ value: item.value, label: item.label }))}
              selected={workoutTemplateBodyPart}
              onSelect={(value) => setWorkoutTemplateBodyPart(value as BodyPart)}
            />
            <SelectRow
              label="목적"
              options={purposeOptions.map((item) => ({ value: item.value, label: item.label }))}
              selected={workoutTemplatePurpose}
              onSelect={(value) => setWorkoutTemplatePurpose(value as WorkoutPurpose)}
            />
            <SelectRow
              label="도구"
              options={toolOptions.map((item) => ({ value: item.value, label: item.label }))}
              selected={workoutTemplateTool}
              onSelect={(value) => setWorkoutTemplateTool(value as WorkoutTool)}
            />
            <FieldInput
              label="기본 시간(분)"
              value={workoutTemplateDuration}
              onChangeText={setWorkoutTemplateDuration}
              placeholder="30"
              keyboardType="numeric"
            />
            <Pressable style={[styles.primaryButton, styles.actionGap]} onPress={createWorkoutTemplate}>
              <Text style={styles.primaryButtonText}>운동 템플릿 추가</Text>
            </Pressable>

            <Text style={styles.hint}>등록된 운동 템플릿</Text>
            <View style={styles.chipRowWrap}>
              {workoutTemplates.length === 0 ? <Text style={styles.hint}>등록된 템플릿이 없습니다.</Text> : null}
              {workoutTemplates.map((template) => (
                <View key={template.id} style={styles.pillRow}>
                  <Text style={styles.pillLabel}>{template.label}</Text>
                  <Text style={styles.hint}>{template.isActive ? "ON" : "OFF"}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>리마인더</Text>
            <FieldInput
              label="일일 알림"
              value={reminder.dailyReminderTime}
              onChangeText={(value) => setReminder((prev) => ({ ...prev, dailyReminderTime: value }))}
              placeholder="20:00"
            />
            <FieldInput
              label="미기록 감지"
              value={reminder.missingLogReminderTime}
              onChangeText={(value) => setReminder((prev) => ({ ...prev, missingLogReminderTime: value }))}
              placeholder="21:30"
            />
            <Pressable style={[styles.primaryButton, styles.actionGap]} onPress={saveReminder}>
              <Text style={styles.primaryButtonText}>리마인더 저장</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>계정</Text>
            <Pressable style={[styles.primaryButton, styles.actionGap]} onPress={upgradeGoogleMobile}>
              <Text style={styles.primaryButtonText}>Google로 계정 전환</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "records" && day.mealCheckins.length + day.workoutLogs.length + day.bodyMetrics.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>오늘 기록 요약 ({formatDateLabel(selectedDate)})</Text>
            <Text style={styles.hint}>식단 체크인: {day.mealCheckins.filter((item) => !item.isDeleted).length}건</Text>
            <Text style={styles.hint}>운동 기록: {day.workoutLogs.filter((item) => !item.isDeleted).length}건</Text>
            <Text style={styles.hint}>체성분: {day.bodyMetrics.filter((item) => !item.isDeleted).length}건</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  brand: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  tabButtonActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand
  },
  tabText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "600"
  },
  tabTextActive: {
    color: colors.brandOn
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl
  },
  card: {
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
    gap: spacing.sm
  },
  subCard: {
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#f7fbfb",
    padding: spacing.sm,
    gap: spacing.xs
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary
  },
  sectionSubTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary
  },
  value: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary
  },
  info: {
    fontSize: 13,
    color: colors.textSecondary,
    minHeight: 16
  },
  messageError: {
    fontSize: 13,
    color: "#c62828",
    minHeight: 16
  },
  messageInfo: {
    fontSize: 13,
    color: colors.brand,
    minHeight: 16
  },
  messageSuccess: {
    fontSize: 13,
    color: "#1b5e20",
    minHeight: 16
  },
  field: {
    gap: 6
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600"
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  chipRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#fff"
  },
  chipActive: {
    borderColor: colors.brand,
    backgroundColor: "#e5f5ef"
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600"
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  pillRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    minWidth: "48%"
  },
  pillLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600"
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    color: colors.brandOn,
    fontWeight: "700",
    fontSize: 15
  },
  actionGap: {
    marginTop: spacing.md
  },
  form: {
    gap: spacing.sm
  }
});
