import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import {
  GoogleSignin,
  isErrorWithCode,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
  statusCodes
} from "@react-native-google-signin/google-signin";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Modal,
  FlatList,
  Platform,
  StatusBar as RNStatusBar,
  View,
  type KeyboardTypeOptions,
  type LayoutChangeEvent
} from "react-native";
import * as React from "react";
import { cardRadius, colors, spacing } from "@routinemate/ui";
import { LineChart } from "react-native-chart-kit";
import { clearStoredSessionId, persistSessionId, readStoredSessionId } from "./src/lib/session-store";
import { computeMetricChartWidth } from "./src/lib/metric-chart-width";

const ChartLine = LineChart as unknown as React.ComponentType<any>;

type TabKey = "dashboard" | "records" | "settings";

const NAV_ITEMS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: "dashboard", label: "대시보드" },
  { key: "records", label: "기록" },
  { key: "settings", label: "설정" }
];

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
  bodyMetricTrend: Array<{
    date: string;
    weightKg: number | null;
    bodyFatPct: number | null;
  }>;
  buckets: Array<{
    key: string;
    label: string;
    from: string;
    to: string;
    avgOverallScore: number;
    mealCheckRate: number;
    workoutRate: number;
    bodyMetricRate: number;
  }>;
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

type ReminderEvaluation = {
  date: string;
  mealCount: number;
  workoutCount: number;
  isMissingLogCandidate: boolean;
};

const DEFAULT_REMINDER_TIMEZONE = "Asia/Seoul";
const DEFAULT_REMINDER_CHANNELS: Array<ReminderSettings["channels"][number]> = ["web_in_app", "mobile_local"];

type MealSlot = "breakfast" | "lunch" | "dinner" | "dinner2";

type MealTemplate = {
  id: string;
  label: string;
  mealSlot?: MealSlot;
  isActive: boolean;
};

type BodyPart = "chest" | "back" | "legs" | "core" | "shoulders" | "arms" | "full_body" | "cardio";
type WorkoutPurpose = "muscle_gain" | "fat_loss" | "endurance" | "mobility" | "recovery";
type WorkoutTool = "bodyweight" | "dumbbell" | "machine" | "barbell" | "kettlebell" | "mixed";
type WorkoutIntensity = "low" | "medium" | "high";
type WorkoutSlot = "am" | "pm";

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
  workoutSlot?: WorkoutSlot;
  completed?: boolean;
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

type MessageType = "error" | "success" | "info";
type Message = {
  type: MessageType;
  text: string;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://routinemate-kohl.vercel.app";
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

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
    credentials: "include",
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

function formatBucketLabel(
  bucket: Dashboard["buckets"][number],
  granularity: Dashboard["granularity"]
): string {
  if (granularity === "day") {
    return bucket.label;
  }
  return `${bucket.label} (${bucket.from.slice(5)}~${bucket.to.slice(5)})`;
}

type PickerOption = {
  value: string;
  label: string;
};

type OptionPickerState = {
  title: string;
  selected: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
};

function buildDateOptions(daysBack: number, daysForward: number): PickerOption[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const options: PickerOption[] = [];
  for (let diff = -daysBack; diff <= daysForward; diff += 1) {
    const valueDate = new Date(base);
    valueDate.setDate(base.getDate() + diff);
    const value = valueDate.toISOString().slice(0, 10);
    options.push({
      value,
      label: `${value} (${valueDate.toLocaleDateString("ko-KR", { weekday: "short" })})`
    });
  }
  return options;
}

function buildTimeOptions(stepMinutes = 5): PickerOption[] {
  const options: PickerOption[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += stepMinutes) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      options.push({ value, label: value });
    }
  }
  return options;
}

function buildDecimalOptions(min: number, max: number, step: number, unit: string): PickerOption[] {
  const options: PickerOption[] = [];
  for (let current = min; current <= max + 0.00001; current += step) {
    const value = current.toFixed(1);
    options.push({ value, label: `${value}${unit}` });
  }
  return options;
}

function buildIntegerOptions(min: number, max: number, unit = ""): PickerOption[] {
  const options: PickerOption[] = [];
  for (let current = min; current <= max; current += 1) {
    const value = String(current);
    options.push({ value, label: unit ? `${value}${unit}` : value });
  }
  return options;
}

type MetricLineChartProps = {
  title: string;
  unit: string;
  color: string;
  points: Array<{ date: string; value: number }>;
};

function MetricLineChart({ title, unit, color, points }: MetricLineChartProps): React.JSX.Element {
  if (points.length === 0) {
    return (
      <View style={styles.metricCard}>
        <Text style={styles.sectionSubTitle}>{title}</Text>
        <Text style={styles.hint}>기록이 쌓이면 라인차트가 표시됩니다.</Text>
      </View>
    );
  }

  const labels = points.map((point, index) =>
    index === 0 || index === points.length - 1 ? point.date.slice(5) : ""
  );
  const values = points.map((item) => Number(item.value.toFixed(1)));
  const latest = points[points.length - 1]?.value;
  const firstDate = points[0]?.date ?? "";
  const lastDate = points[points.length - 1]?.date ?? "";
  const [chartWidth, setChartWidth] = React.useState(0);

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextWidth = computeMetricChartWidth(event.nativeEvent.layout.width);
    setChartWidth((current) => (current === nextWidth ? current : nextWidth));
  }, []);

  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <Text style={styles.sectionSubTitle}>{title}</Text>
        <Text style={styles.metricLatest}>{latest !== undefined ? `${latest.toFixed(1)}${unit}` : "--"}</Text>
      </View>
      <View style={styles.metricChartWrap} onLayout={handleLayout}>
        {chartWidth > 0 ? (
          <ChartLine
            data={{
              labels,
              datasets: [{ data: values, color: () => color, strokeWidth: 2.5 }]
            }}
            width={chartWidth}
            height={180}
            withInnerLines
            withOuterLines={false}
            withVerticalLines={false}
            withHorizontalLabels
            withVerticalLabels
            fromZero={false}
            segments={4}
            bezier={points.length >= 3}
            chartConfig={{
              backgroundGradientFrom: "#fbfcfd",
              backgroundGradientTo: "#fbfcfd",
              decimalPlaces: 1,
              color: () => color,
              labelColor: () => colors.textSecondary,
              propsForDots: {
                r: "3",
                strokeWidth: "1",
                stroke: color
              },
              propsForBackgroundLines: {
                stroke: "#d8dde1",
                strokeWidth: 1
              }
            }}
            style={styles.metricChart}
          />
        ) : null}
      </View>
      <Text style={styles.metricRangeText}>
        {firstDate} ~ {lastDate}
      </Text>
    </View>
  );
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

function PickerField({
  label,
  value,
  placeholder,
  onPress
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.pickerInput} onPress={onPress}>
        <Text style={[styles.pickerInputText, value ? null : styles.pickerPlaceholder]}>{value || placeholder}</Text>
      </Pressable>
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
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
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
  const [editingMealTemplateId, setEditingMealTemplateId] = React.useState<string | null>(null);
  const [editingMealTemplateDraft, setEditingMealTemplateDraft] = React.useState<{ label: string }>({
    label: ""
  });

  const [workoutTemplateLabel, setWorkoutTemplateLabel] = React.useState("");
  const [workoutTemplateBodyPart, setWorkoutTemplateBodyPart] = React.useState<BodyPart>("full_body");
  const [workoutTemplatePurpose, setWorkoutTemplatePurpose] = React.useState<WorkoutPurpose>("fat_loss");
  const [workoutTemplateTool, setWorkoutTemplateTool] = React.useState<WorkoutTool>("bodyweight");
  const [workoutTemplateDuration, setWorkoutTemplateDuration] = React.useState("30");
  const [editingWorkoutTemplateId, setEditingWorkoutTemplateId] = React.useState<string | null>(null);
  const [editingWorkoutTemplateDraft, setEditingWorkoutTemplateDraft] = React.useState<{
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

  const [weightForm, setWeightForm] = React.useState("");
  const [bodyFatForm, setBodyFatForm] = React.useState("");
  const [bodyMetricDate, setBodyMetricDate] = React.useState(today);

  const [goalTarget, setGoalTarget] = React.useState("4");
  const [goalWeight, setGoalWeight] = React.useState("");
  const [goalFat, setGoalFat] = React.useState("");
  const [goalDday, setGoalDday] = React.useState("");
  const [isGoalDraftDirty, setGoalDraftDirty] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [reminderEvaluation, setReminderEvaluation] = React.useState<ReminderEvaluation | null>(null);
  const dashboardCacheRef = React.useRef<Partial<Record<"7d" | "30d" | "90d", Dashboard>>>({});

  const [reminder, setReminder] = React.useState<ReminderSettings>({
    isEnabled: true,
    dailyReminderTime: "20:00",
    missingLogReminderTime: "21:30",
    channels: DEFAULT_REMINDER_CHANNELS,
    timezone: DEFAULT_REMINDER_TIMEZONE
  });
  const [optionPicker, setOptionPicker] = React.useState<OptionPickerState | null>(null);

  const dateOptions = React.useMemo(() => buildDateOptions(365, 365), []);
  const ddayOptions = React.useMemo(
    () => [{ value: "", label: "미설정" }, ...buildDateOptions(0, 1095)],
    []
  );
  const timeOptions = React.useMemo(() => buildTimeOptions(5), []);
  const weeklyTargetOptions = React.useMemo(() => buildIntegerOptions(1, 21, "회"), []);
  const weightOptions = React.useMemo(
    () => [{ value: "", label: "미입력" }, ...buildDecimalOptions(30, 200, 0.1, "kg")],
    []
  );
  const bodyFatOptions = React.useMemo(
    () => [{ value: "", label: "미입력" }, ...buildDecimalOptions(3, 60, 0.1, "%")],
    []
  );
  const weightTrendPoints = React.useMemo(
    () =>
      (dashboard?.bodyMetricTrend ?? [])
        .filter((item) => item.weightKg !== null)
        .map((item) => ({ date: item.date, value: item.weightKg as number })),
    [dashboard?.bodyMetricTrend]
  );
  const bodyFatTrendPoints = React.useMemo(
    () =>
      (dashboard?.bodyMetricTrend ?? [])
        .filter((item) => item.bodyFatPct !== null)
        .map((item) => ({ date: item.date, value: item.bodyFatPct as number })),
    [dashboard?.bodyMetricTrend]
  );

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
  const workoutCheckinBySlot = React.useMemo(() => {
    const map = new Map<WorkoutSlot, WorkoutLog>();
    for (const item of day.workoutLogs) {
      if (item.isDeleted || !item.workoutSlot) {
        continue;
      }
      const existing = map.get(item.workoutSlot);
      if (!existing || item.date >= existing.date) {
        map.set(item.workoutSlot, item);
      }
    }
    return map;
  }, [day.workoutLogs]);
  const statusBarOffset = React.useMemo(() => {
    if (Platform.OS === "android") {
      return (RNStatusBar.currentHeight ?? 0) + spacing.sm;
    }
    return 24;
  }, []);

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

  React.useEffect(() => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      return;
    }
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID
    });
  }, []);

  const sessionInfoText = React.useMemo(() => {
    if (!session) {
      return "Google 로그인 필요";
    }
    if (session.authProvider === "google") {
      return `Google 연결됨 (${session.email ?? "이메일 없음"})`;
    }
    return `세션: ${session.sessionId.slice(0, 10)}...`;
  }, [session]);

  const closeMenu = React.useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const navigateWithMenu = React.useCallback(
    (nextTab: TabKey) => {
      setTab(nextTab);
      closeMenu();
    },
    [closeMenu]
  );

  const refreshCoreSessionData = React.useCallback(async (fresh = false) => {
    if (!session) {
      return;
    }

    try {
      setIsSyncing(true);
      const dashboardDate = todayYmd();
      const freshSuffix = fresh ? "&fresh=1" : "";
      const [dashboardData, goalData, reminderSettingsData] = await Promise.all([
        apiFetch<Dashboard>(
          `/api/v1/dashboard?sessionId=${encodeURIComponent(session.sessionId)}&range=${range}&date=${encodeURIComponent(dashboardDate)}${freshSuffix}`
        ),
        apiFetch<{ goal: Goal | null }>(`/api/v1/goals?sessionId=${encodeURIComponent(session.sessionId)}`),
        apiFetch<{ settings: ReminderSettings | null }>(`/api/v1/reminders/settings?sessionId=${encodeURIComponent(session.sessionId)}`).then(
          (payload: { settings: ReminderSettings | null }) => payload
        )
      ]);

      setDashboard(dashboardData ?? null);
      if (dashboardData) {
        dashboardCacheRef.current[range] = dashboardData;
      }
      setGoal(goalData?.goal ?? null);
      if (reminderSettingsData?.settings) {
        setReminder(reminderSettingsData.settings);
      }

      if (!isGoalDraftDirty) {
        setGoalTarget(String(goalData?.goal?.weeklyRoutineTarget ?? 4));
        setGoalWeight(goalData?.goal?.targetWeightKg?.toString() ?? "");
        setGoalFat(goalData?.goal?.targetBodyFat?.toString() ?? "");
        setGoalDday(goalData?.goal?.dDay ?? "");
      }

      if (!fresh) {
        const candidateRanges: Array<"7d" | "30d" | "90d"> = ["7d", "30d", "90d"];
        for (const candidate of candidateRanges) {
          if (candidate === range || dashboardCacheRef.current[candidate]) {
            continue;
          }
          void apiFetch<Dashboard>(
            `/api/v1/dashboard?sessionId=${encodeURIComponent(session.sessionId)}&range=${candidate}&date=${encodeURIComponent(dashboardDate)}`
          )
            .then((next) => {
              dashboardCacheRef.current[candidate] = next;
            })
            .catch(() => {
              // ignore background prefetch failures
            });
        }
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "조회에 실패했습니다." });
    } finally {
      setIsSyncing(false);
    }
  }, [isGoalDraftDirty, range, session]);

  const loadTemplateCatalog = React.useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const [mealTemplatesData, workoutTemplatesData] = await Promise.all([
        apiFetch<{ templates: MealTemplate[] }>(`/api/v1/templates/meals?sessionId=${encodeURIComponent(session.sessionId)}`),
        apiFetch<{ templates: WorkoutTemplate[] }>(`/api/v1/templates/workouts?sessionId=${encodeURIComponent(session.sessionId)}`)
      ]);
      setMealTemplates(mealTemplatesData.templates ?? []);
      setWorkoutTemplates(workoutTemplatesData.templates ?? []);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "템플릿 조회에 실패했습니다." });
    }
  }, [session]);

  const loadDayData = React.useCallback(
    async (date: string) => {
      if (!session) {
        return;
      }

      try {
        setIsSyncing(true);
        const [dayData, reminderEvaluationData] = await Promise.all([
          apiFetch<DaySnapshot>(`/api/v1/calendar/day?sessionId=${encodeURIComponent(session.sessionId)}&date=${encodeURIComponent(date)}`),
          apiFetch<ReminderEvaluation>(
            `/api/v1/reminders/evaluate?sessionId=${encodeURIComponent(session.sessionId)}&date=${encodeURIComponent(date)}`
          )
        ]);

        setDay(dayData ?? defaultDay(date));
        setReminderEvaluation(reminderEvaluationData ?? { date, mealCount: 0, workoutCount: 0, isMissingLogCandidate: false });
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "날짜 기록을 불러오지 못했습니다." });
      } finally {
        setIsSyncing(false);
      }
    },
    [session]
  );

  const refreshWorkspaceAfterMutation = React.useCallback(
    async () => {
      if (!session) {
        return;
      }
      await Promise.all([refreshCoreSessionData(true), loadDayData(selectedDate)]);
    },
    [loadDayData, refreshCoreSessionData, selectedDate, session]
  );

  React.useEffect(() => {
    let mounted = true;
    const restoreSession = async (): Promise<void> => {
      try {
        const restored = await apiFetch<Session | null>("/api/v1/auth/session");
        if (!mounted) {
          return;
        }
        if (restored?.sessionId) {
          setSession(restored);
          await persistSessionId(restored.sessionId);
          return;
        }

        const storedSessionId = await readStoredSessionId();
        if (!mounted) {
          return;
        }
        if (storedSessionId) {
          try {
            const restoredByStoredId = await apiFetch<Session | null>(
              `/api/v1/auth/session?sessionId=${encodeURIComponent(storedSessionId)}`
            );
            if (!mounted) {
              return;
            }
            if (restoredByStoredId?.sessionId) {
              setSession(restoredByStoredId);
              await persistSessionId(restoredByStoredId.sessionId);
              return;
            }
            await clearStoredSessionId();
          } catch {
            await clearStoredSessionId();
          }
        }

        if (!GOOGLE_WEB_CLIENT_ID) {
          return;
        }

        const silentResult = await GoogleSignin.signInSilently();
        if (!mounted || isNoSavedCredentialFoundResponse(silentResult) || !isSuccessResponse(silentResult)) {
          return;
        }
        const idToken = silentResult.data.idToken;
        if (!idToken) {
          return;
        }

        const googleSession = await apiFetch<Session>("/api/v1/auth/google/session", {
          method: "POST",
          body: JSON.stringify({
            idToken,
            platform: "android",
            mode: "native_sdk"
          })
        });
        if (mounted) {
          setSession(googleSession);
          await persistSessionId(googleSession.sessionId);
          setMessage({ type: "success", text: "Google 세션이 복원되었습니다." });
        }
      } catch {
        if (mounted) {
          setMessage({ type: "info", text: "Google 로그인 후 데이터 동기화를 시작할 수 있습니다." });
        }
      }
    };

    void restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!session?.sessionId) {
      return;
    }
    void persistSessionId(session.sessionId);
  }, [session?.sessionId]);

  React.useEffect(() => {
    if (!session) {
      return;
    }
    const cachedDashboard = dashboardCacheRef.current[range];
    if (cachedDashboard) {
      setDashboard(cachedDashboard);
    }
    void refreshCoreSessionData();
    void loadTemplateCatalog();
  }, [loadTemplateCatalog, range, refreshCoreSessionData, session]);

  React.useEffect(() => {
    if (tab !== "records") {
      return;
    }
    void loadDayData(selectedDate);
  }, [loadDayData, selectedDate, tab]);

  React.useEffect(() => {
    setBodyMetricDate(selectedDate);
  }, [selectedDate]);

  const upsertMealCheckin = React.useCallback(
    async (slot: MealSlot, completed: boolean, templateId?: string) => {
      if (!session) {
        setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
        return;
      }

      const existing = checkinBySlot.get(slot);
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
        setMessage({ type: "error", text: "활성 식단 템플릿이 필요합니다." });
        return;
      }

      const payload = {
        sessionId: session.sessionId,
        date: selectedDate,
        slot,
        completed,
        ...(selectedTemplateId ? { templateId: selectedTemplateId } : {})
      };

      const previousDay = day;
      const optimistic: MealCheckin = {
        id: existing?.id ?? `tmp-meal-${Date.now()}`,
        date: selectedDate,
        slot,
        completed
      };
      if (selectedTemplateId) {
        optimistic.templateId = selectedTemplateId;
      }

      setDay((current) => ({
        ...current,
        mealCheckins: existing
          ? current.mealCheckins.map((item) => {
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
      void refreshWorkspaceAfterMutation();
    },
    [activeMealTemplates, checkinBySlot, day, refreshWorkspaceAfterMutation, selectedDate, session]
  );

  const deleteMealCheckin = React.useCallback(
    async (slot: MealSlot) => {
      if (!session) {
        setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
        return;
      }
      const existing = checkinBySlot.get(slot);
      if (!existing) {
        return;
      }

      const previousDay = day;
      setDay((current) => ({
        ...current,
        mealCheckins: current.mealCheckins.filter((item) => item.id !== existing.id)
      }));

      try {
        await apiFetch<unknown>(`/api/v1/meal-checkins/${existing.id}`, {
          method: "DELETE",
          body: JSON.stringify({ sessionId: session.sessionId })
        });
        setMessage({ type: "info", text: "식단 체크인을 삭제했습니다." });
      } catch (error) {
        setDay(previousDay);
        setMessage({ type: "error", text: error instanceof Error ? error.message : "식단 삭제 실패" });
      }
      void refreshWorkspaceAfterMutation();
    },
    [checkinBySlot, day, refreshWorkspaceAfterMutation, session, selectedDate]
  );

  const upsertWorkoutCheckin = React.useCallback(
    async (slot: WorkoutSlot, completed: boolean, templateId?: string) => {
      if (!session) {
        setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
        return;
      }

      const existing = workoutCheckinBySlot.get(slot);
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
        setMessage({ type: "error", text: "활성 운동 템플릿이 필요합니다." });
        return;
      }
      const selectedTemplate = selectedTemplateId
        ? activeWorkoutTemplates.find((item) => item.id === selectedTemplateId)
        : undefined;
      const defaults = defaultWorkoutBySlot(slot);
      const payload = {
        sessionId: session.sessionId,
        date: selectedDate,
        slot,
        completed,
        ...(selectedTemplateId ? { templateId: selectedTemplateId } : {})
      };

      const optimistic: WorkoutLog = {
        id: existing?.id ?? `tmp-workout-${Date.now()}`,
        date: selectedDate,
        bodyPart: selectedTemplate?.bodyPart ?? existing?.bodyPart ?? defaults.bodyPart,
        purpose: selectedTemplate?.purpose ?? existing?.purpose ?? defaults.purpose,
        tool: selectedTemplate?.tool ?? existing?.tool ?? defaults.tool,
        exerciseName: selectedTemplate?.label ?? existing?.exerciseName ?? defaults.exerciseName,
        intensity: existing?.intensity ?? defaults.intensity,
        workoutSlot: slot,
        completed,
        ...((selectedTemplate?.defaultDuration ?? existing?.durationMinutes ?? defaults.durationMinutes) !== undefined
          ? { durationMinutes: selectedTemplate?.defaultDuration ?? existing?.durationMinutes ?? defaults.durationMinutes }
          : {}),
        ...(selectedTemplateId ? { templateId: selectedTemplateId } : {})
      };

      const previousDay = day;
      setDay((current) => ({
        ...current,
        workoutLogs: existing
          ? current.workoutLogs.map((item) => (item.id === existing.id ? { ...item, ...optimistic } : item))
          : [optimistic, ...current.workoutLogs]
      }));

      try {
        const saved = await (existing
          ? apiFetch<WorkoutLog>(`/api/v1/workout-checkins/${existing.id}`, {
              method: "PATCH",
              body: JSON.stringify(payload)
            })
          : apiFetch<WorkoutLog>("/api/v1/workout-checkins", {
              method: "POST",
              body: JSON.stringify(payload)
            }));
        if (saved?.id) {
          setDay((current) => ({
            ...current,
            workoutLogs: [saved, ...current.workoutLogs.filter((item) => item.id !== optimistic.id && item.id !== saved.id)]
          }));
        }
        setMessage({
          type: "success",
          text: `${workoutSlots.find((item) => item.value === slot)?.label ?? "운동"} 체크인을 저장했습니다.`
        });
      } catch (error) {
        setDay(previousDay);
        setMessage({ type: "error", text: error instanceof Error ? error.message : "운동 저장 실패" });
      }
      void refreshWorkspaceAfterMutation();
    },
    [activeWorkoutTemplates, day, refreshWorkspaceAfterMutation, selectedDate, session, workoutCheckinBySlot]
  );

  const deleteWorkoutCheckin = React.useCallback(
    async (slot: WorkoutSlot) => {
      if (!session) {
        setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
        return;
      }

      const existing = workoutCheckinBySlot.get(slot);
      if (!existing) {
        return;
      }

      const previousDay = day;
      setDay((current) => ({ ...current, workoutLogs: current.workoutLogs.filter((item) => item.id !== existing.id) }));
      try {
        await apiFetch<unknown>(`/api/v1/workout-checkins/${existing.id}`, {
          method: "DELETE",
          body: JSON.stringify({ sessionId: session.sessionId })
        });
        setMessage({ type: "info", text: "운동 체크인을 삭제했습니다." });
      } catch (error) {
        setDay(previousDay);
        setMessage({ type: "error", text: error instanceof Error ? error.message : "운동 삭제 실패" });
      }
      void refreshWorkspaceAfterMutation();
    },
    [day, refreshWorkspaceAfterMutation, session, workoutCheckinBySlot]
  );

  const deleteWorkoutLog = React.useCallback(
    async (logId: string) => {
      if (!session) {
        setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
        return;
      }

      const previousDay = day;
      setDay((current) => ({ ...current, workoutLogs: current.workoutLogs.filter((item) => item.id !== logId) }));
      try {
        await apiFetch<unknown>(`/api/v1/workout-logs/${logId}`, {
          method: "DELETE",
          body: JSON.stringify({ sessionId: session.sessionId })
        });
        setMessage({ type: "info", text: "운동 기록을 삭제했습니다." });
      } catch (error) {
        setDay(previousDay);
        setMessage({ type: "error", text: error instanceof Error ? error.message : "운동 삭제 실패" });
      }
      void refreshWorkspaceAfterMutation();
    },
    [day, refreshWorkspaceAfterMutation, session]
  );

  const saveBodyMetric = React.useCallback(async () => {
    if (!session) {
      setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
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
    void refreshWorkspaceAfterMutation();
  }, [bodyFatForm, bodyMetricDate, day, refreshWorkspaceAfterMutation, session, weightForm]);

  const deleteBodyMetric = React.useCallback(
    async (metricId: string) => {
      if (!session) {
        setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
        return;
      }

      const previousDay = day;
      setDay((current) => ({
        ...current,
        bodyMetrics: current.bodyMetrics.filter((item) => item.id !== metricId)
      }));

      try {
        await apiFetch<unknown>(`/api/v1/body-metrics/${metricId}`, {
          method: "DELETE",
          body: JSON.stringify({ sessionId: session.sessionId })
        });
        setMessage({ type: "info", text: "체성분 기록을 삭제했습니다." });
      } catch (error) {
        setDay(previousDay);
        setMessage({ type: "error", text: error instanceof Error ? error.message : "체성분 삭제 실패" });
      }
      void refreshWorkspaceAfterMutation();
    },
    [day, refreshWorkspaceAfterMutation, session, bodyMetricDate]
  );

  const saveGoal = React.useCallback(async () => {
    if (!session) {
      setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
      return;
    }

    const weeklyRoutineTarget = parseNumber(goalTarget);
    if (!weeklyRoutineTarget || weeklyRoutineTarget < 1 || weeklyRoutineTarget > 21) {
      setMessage({ type: "error", text: "주간 루틴 목표는 1~21 범위여야 합니다." });
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
      setGoalDraftDirty(false);
      setMessage({ type: "success", text: "목표를 저장했습니다." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "목표 저장 실패" });
    }
    void refreshWorkspaceAfterMutation();
  }, [goalDday, goalFat, goalTarget, goalWeight, refreshWorkspaceAfterMutation, session]);

  const createMealTemplate = React.useCallback(async () => {
    if (!session) {
      setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
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
  }, [mealTemplateLabel, mealTemplates, session]);

  const updateMealTemplate = React.useCallback(
    async (id: string, updates: Partial<Pick<MealTemplate, "label" | "isActive">>) => {
      if (!session) {
        setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
        return;
      }
      const previous = mealTemplates;
      if (!mealTemplates.find((item) => item.id === id)) {
        setMessage({ type: "error", text: "수정할 템플릿을 찾지 못했습니다." });
        return;
      }
      setMealTemplates((current) => current.map((item) => (item.id === id ? { ...item, ...updates } : item)));
      try {
        const saved = await apiFetch<MealTemplate>(`/api/v1/templates/meals/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            sessionId: session.sessionId,
            ...(updates.label !== undefined ? { label: updates.label } : {}),
            ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {})
          })
        });
        if (saved?.id) {
          setMealTemplates((current) => current.map((item) => (item.id === saved.id ? saved : item)));
        }
        setMessage({ type: "success", text: "식단 템플릿을 수정했습니다." });
      } catch (error) {
        setMealTemplates(previous);
        setMessage({ type: "error", text: error instanceof Error ? error.message : "식단 템플릿 수정 실패" });
      }
    },
    [mealTemplates, session]
  );

  const saveMealTemplateEdit = React.useCallback(async () => {
    if (!editingMealTemplateId) {
      return;
    }
    const trimmed = editingMealTemplateDraft.label.trim();
    if (!trimmed.length) {
      setMessage({ type: "error", text: "식단 템플릿 이름을 입력해 주세요." });
      return;
    }
    await updateMealTemplate(editingMealTemplateId, {
      label: trimmed
    });
    setEditingMealTemplateId(null);
  }, [editingMealTemplateDraft.label, editingMealTemplateId, updateMealTemplate]);

  const deactivateMealTemplate = React.useCallback(async (id: string) => {
    await updateMealTemplate(id, { isActive: false });
  }, [updateMealTemplate]);

  const startMealTemplateEdit = React.useCallback((template: MealTemplate) => {
    setEditingMealTemplateId(template.id);
    setEditingMealTemplateDraft({ label: template.label });
  }, []);

  const createWorkoutTemplate = React.useCallback(async () => {
    if (!session) {
      setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
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

  const updateWorkoutTemplate = React.useCallback(
    async (
      id: string,
      updates: Partial<
        Pick<WorkoutTemplate, "label" | "bodyPart" | "purpose" | "tool" | "defaultDuration" | "isActive">
      >
    ) => {
      if (!session) {
        setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
        return;
      }

      const previous = workoutTemplates;
      if (!workoutTemplates.find((item) => item.id === id)) {
        setMessage({ type: "error", text: "수정할 템플릿을 찾지 못했습니다." });
        return;
      }

      setWorkoutTemplates((current) => current.map((item) => (item.id === id ? { ...item, ...updates } : item)));
      try {
        const saved = await apiFetch<WorkoutTemplate>(`/api/v1/templates/workouts/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            sessionId: session.sessionId,
            ...(updates.label !== undefined ? { label: updates.label } : {}),
            ...(updates.bodyPart !== undefined ? { bodyPart: updates.bodyPart } : {}),
            ...(updates.purpose !== undefined ? { purpose: updates.purpose } : {}),
            ...(updates.tool !== undefined ? { tool: updates.tool } : {}),
            ...(updates.defaultDuration !== undefined ? { defaultDuration: updates.defaultDuration } : {}),
            ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {})
          })
        });
        if (saved?.id) {
          setWorkoutTemplates((current) => current.map((item) => (item.id === saved.id ? saved : item)));
        }
        setMessage({ type: "success", text: "운동 템플릿을 수정했습니다." });
      } catch (error) {
        setWorkoutTemplates(previous);
        setMessage({ type: "error", text: error instanceof Error ? error.message : "운동 템플릿 수정 실패" });
      }
    },
    [session, workoutTemplates]
  );

  const saveWorkoutTemplateEdit = React.useCallback(async () => {
    if (!editingWorkoutTemplateId) {
      return;
    }
    const trimmed = editingWorkoutTemplateDraft.label.trim();
    if (!trimmed.length) {
      setMessage({ type: "error", text: "운동 템플릿 이름을 입력해 주세요." });
      return;
    }

    const defaultDuration = parseNumber(editingWorkoutTemplateDraft.defaultDuration);
    await updateWorkoutTemplate(editingWorkoutTemplateId, {
      label: trimmed,
      bodyPart: editingWorkoutTemplateDraft.bodyPart,
      purpose: editingWorkoutTemplateDraft.purpose,
      tool: editingWorkoutTemplateDraft.tool,
      ...(defaultDuration !== undefined ? { defaultDuration: Math.trunc(defaultDuration) } : {})
    });
    setEditingWorkoutTemplateId(null);
  }, [
    editingWorkoutTemplateDraft.bodyPart,
    editingWorkoutTemplateDraft.defaultDuration,
    editingWorkoutTemplateDraft.label,
    editingWorkoutTemplateDraft.purpose,
    editingWorkoutTemplateDraft.tool,
    editingWorkoutTemplateId,
    updateWorkoutTemplate
  ]);

  const deactivateWorkoutTemplate = React.useCallback(async (id: string) => {
    await updateWorkoutTemplate(id, { isActive: false });
  }, [updateWorkoutTemplate]);

  const startWorkoutTemplateEdit = React.useCallback((template: WorkoutTemplate) => {
    setEditingWorkoutTemplateId(template.id);
    setEditingWorkoutTemplateDraft({
      label: template.label,
      bodyPart: template.bodyPart,
      purpose: template.purpose,
      tool: template.tool,
      defaultDuration: String(template.defaultDuration ?? 30)
    });
  }, []);

  const toggleReminderChannel = React.useCallback((channel: string) => {
    setReminder((current) => {
      const nextChannels = current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel];
      return {
        ...current,
        channels: nextChannels
      };
    });
  }, []);

  const openOptionPicker = React.useCallback(
    (title: string, options: PickerOption[], selected: string, onSelect: (value: string) => void) => {
      setOptionPicker({ title, options, selected, onSelect });
    },
    []
  );

  const closeOptionPicker = React.useCallback(() => {
    setOptionPicker(null);
  }, []);

  const saveReminder = React.useCallback(async () => {
    if (!session) {
      setMessage({ type: "error", text: "먼저 Google 로그인 후 이용해 주세요." });
      return;
    }

    if (reminder.channels.length === 0) {
      setMessage({ type: "error", text: "최소 하나 이상의 알림 채널을 선택해 주세요." });
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
      if (!GOOGLE_WEB_CLIENT_ID) {
        setMessage({ type: "error", text: "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID가 필요합니다." });
        return;
      }
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true
      });
      const signInResult = await GoogleSignin.signIn();
      if (!isSuccessResponse(signInResult)) {
        setMessage({ type: "info", text: "Google 인증이 취소되었습니다." });
        return;
      }
      const idToken = signInResult.data.idToken;
      if (!idToken) {
        setMessage({ type: "error", text: "Google idToken 획득에 실패했습니다." });
        return;
      }
      const shouldUpgradeGuest = Boolean(session) && session?.isGuest === true;
      const payload = await apiFetch<Session>(shouldUpgradeGuest ? "/api/v1/auth/upgrade/google" : "/api/v1/auth/google/session", {
        method: "POST",
        body: JSON.stringify({
          ...(shouldUpgradeGuest ? { sessionId: session.sessionId } : {}),
          idToken,
          platform: "android",
          mode: "native_sdk"
        })
      });
      setSession(payload);
      await persistSessionId(payload.sessionId);
      setMessage({ type: "success", text: "Google 로그인이 완료되었습니다." });
      void refreshCoreSessionData(true);
      void loadTemplateCatalog();
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          setMessage({ type: "info", text: "Google 인증이 취소되었습니다." });
          return;
        }
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setMessage({ type: "error", text: "Google Play 서비스를 사용할 수 없습니다." });
          return;
        }
        if (error.code === statusCodes.IN_PROGRESS) {
          setMessage({ type: "info", text: "Google 인증이 이미 진행 중입니다." });
          return;
        }
      }
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Google 로그인 실패" });
    }
  }, [loadTemplateCatalog, refreshCoreSessionData, session]);

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: statusBarOffset }]}>
      <StatusBar style="dark" />
      <Modal visible={isMenuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
        <View style={styles.menuOverlay}>
          <Pressable style={styles.menuScrim} onPress={closeMenu} />
          <View style={styles.menuPanel}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>메뉴</Text>
            </View>
            {NAV_ITEMS.map((item) => (
              <Pressable
                key={item.key}
                style={[styles.menuItem, tab === item.key && styles.menuItemActive]}
                onPress={() => navigateWithMenu(item.key)}
              >
                <Text style={[styles.menuItemText, tab === item.key && styles.menuItemTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>RoutineMate</Text>
          <Text style={styles.topBarSub}>{sessionInfoText}</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable style={styles.menuButton} onPress={() => setIsMenuOpen(true)}>
            <Text style={styles.menuButtonText}>☰</Text>
          </Pressable>
          <Pressable style={styles.topPrimaryButton} onPress={upgradeGoogleMobile}>
            <Text style={styles.topPrimaryButtonText}>
              {session?.authProvider === "google" ? "Google 재로그인" : "Google 로그인"}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={messageTextStyle}>{message?.text ?? ""}</Text>

        {tab === "dashboard" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>대시보드</Text>
            <View style={styles.dashboardRangeRow}>
              <Pressable
                style={[styles.dashboardRangeChip, range === "7d" && styles.dashboardRangeChipActive]}
                onPress={() => setRange("7d")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ selected: range === "7d" }}
              >
                <Text style={[styles.dashboardRangeChipText, range === "7d" && styles.dashboardRangeChipTextActive]}>Day</Text>
              </Pressable>
              <Pressable
                style={[styles.dashboardRangeChip, range === "30d" && styles.dashboardRangeChipActive]}
                onPress={() => setRange("30d")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ selected: range === "30d" }}
              >
                <Text style={[styles.dashboardRangeChipText, range === "30d" && styles.dashboardRangeChipTextActive]}>
                  Week
                </Text>
              </Pressable>
              <Pressable
                style={[styles.dashboardRangeChip, range === "90d" && styles.dashboardRangeChipActive]}
                onPress={() => setRange("90d")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ selected: range === "90d" }}
              >
                <Text style={[styles.dashboardRangeChipText, range === "90d" && styles.dashboardRangeChipTextActive]}>
                  Month
                </Text>
              </Pressable>
            </View>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>체크인율</Text>
                <Text style={styles.kpiValue}>{Math.round(dashboard?.adherenceRate ?? 0)}%</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>식단/운동</Text>
                <Text style={styles.kpiValueSmall}>
                  {dashboard?.totalMeals ?? 0} / {dashboard?.totalWorkouts ?? 0}
                </Text>
              </View>
            </View>
            <View style={styles.trendCard}>
              <Text style={styles.sectionSubTitle}>미니 트렌드</Text>
              {dashboard?.buckets?.length ? (
                dashboard.buckets.map((bucket) => (
                  <View key={bucket.key} style={styles.trendRow}>
                    <Text style={styles.trendLabel}>{formatBucketLabel(bucket, dashboard.granularity)}</Text>
                    <View style={styles.trendTrack}>
                      <View style={[styles.trendFill, { width: `${Math.max(0, Math.min(100, bucket.avgOverallScore))}%` }]} />
                    </View>
                    <Text style={styles.trendValue}>{bucket.avgOverallScore}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.hint}>기록이 쌓이면 추세를 표시합니다.</Text>
              )}
            </View>
            <View style={styles.metricPanel}>
              <Text style={styles.sectionSubTitle}>체성분 추세 (전체 기록)</Text>
              <MetricLineChart title="체중" unit="kg" color="#1f7a65" points={weightTrendPoints} />
              <MetricLineChart title="체지방" unit="%" color="#4f79d8" points={bodyFatTrendPoints} />
            </View>
            {goal ? <Text style={styles.hint}>현재 목표: 주 {goal.weeklyRoutineTarget}회</Text> : <Text style={styles.hint}>현재 목표: 미설정</Text>}
            <Text style={styles.hint}>최근 체중 {dashboard?.latestWeightKg ?? "-"}kg / 체지방 {dashboard?.latestBodyFatPct ?? "-"}%</Text>
          </View>
        ) : null}

        {tab === "records" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>기록</Text>
            <PickerField
              label="기록 날짜"
              value={selectedDate}
              placeholder="YYYY-MM-DD"
              onPress={() =>
                openOptionPicker("기록 날짜 선택", dateOptions, selectedDate, (value) => {
                  setSelectedDate(value);
                  closeOptionPicker();
                })
              }
            />
            {session && reminder.isEnabled && reminderEvaluation?.isMissingLogCandidate ? (
              <Text style={styles.messageInfo}>
                미기록 상태입니다. 오늘 기록을 1건이라도 추가하면 경고가 해제됩니다.
              </Text>
            ) : null}
            <Text style={styles.sectionTitle}>식단 체크인</Text>
            <Text style={styles.hint}>활성 식단 템플릿은 아침/점심/저녁/저녁2 슬롯에 공통으로 표시됩니다.</Text>

            {mealSlots.map((slot) => {
              const current = checkinBySlot.get(slot.value);
              const completed = current?.completed ?? false;
              return (
            <View style={styles.subCard} key={slot.value}>
                  <Text style={styles.sectionSubTitle}>{slot.label}</Text>
                  <View style={styles.row}>
                    <Pressable
                      style={[styles.chip, completed && styles.chipActive, activeMealTemplates.length === 0 && styles.chipDisabled]}
                      disabled={activeMealTemplates.length === 0}
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
                    {current ? (
                      <Pressable style={styles.chip} onPress={() => void deleteMealCheckin(slot.value)}>
                        <Text style={styles.chipText}>삭제</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.chipRowWrap}>
                    {activeMealTemplates.length > 0 ? (
                      activeMealTemplates.map((template) => (
                        <Pressable
                          key={template.id}
                          style={[styles.chip, current?.templateId === template.id && styles.chipActive]}
                          onPress={() => void upsertMealCheckin(slot.value, true, template.id)}
                        >
                          <Text style={styles.chipText}>{template.label}</Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.hint}>식단 템플릿을 1개 이상 등록하면 1탭 체크가 가능합니다.</Text>
                    )}
                  </View>
                  <View style={styles.actionGap} />
                </View>
              );
            })}

            <Text style={styles.sectionTitle}>운동 체크인</Text>
            <Text style={styles.hint}>오전/오후 슬롯에서 함/안함만 기록합니다. 함 선택은 활성 운동 템플릿이 필요합니다.</Text>
            {workoutSlots.map((slot) => {
              const current = workoutCheckinBySlot.get(slot.value);
              return (
                <View style={styles.subCard} key={slot.value}>
                  <Text style={styles.sectionSubTitle}>{slot.label}</Text>
                  <View style={styles.row}>
                    <Pressable
                      style={[styles.chip, current?.completed === true && styles.chipActive, activeWorkoutTemplates.length === 0 && styles.chipDisabled]}
                      disabled={activeWorkoutTemplates.length === 0}
                      onPress={() => {
                        void upsertWorkoutCheckin(slot.value, true, current?.templateId);
                      }}
                    >
                      <Text style={styles.chipText}>함</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.chip, current?.completed === false && styles.chipActive]}
                      onPress={() => {
                        void upsertWorkoutCheckin(slot.value, false, current?.templateId);
                      }}
                    >
                      <Text style={styles.chipText}>안함</Text>
                    </Pressable>
                    {current ? (
                      <Pressable style={styles.chip} onPress={() => void deleteWorkoutCheckin(slot.value)}>
                        <Text style={styles.chipText}>삭제</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.chipRowWrap}>
                    {activeWorkoutTemplates.length > 0 ? (
                      activeWorkoutTemplates.map((template) => (
                        <Pressable
                          key={template.id}
                          style={[styles.chip, current?.templateId === template.id && styles.chipActive]}
                          onPress={() => void upsertWorkoutCheckin(slot.value, true, template.id)}
                        >
                          <Text style={styles.chipText}>{template.label}</Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.hint}>설정에서 운동 템플릿을 등록하면 1탭 저장이 가능합니다.</Text>
                    )}
                  </View>
                  <View style={styles.actionGap} />
                </View>
              );
            })}

            <Text style={styles.sectionTitle}>체중/체지방 기록</Text>
            <PickerField
              label="날짜"
              value={bodyMetricDate}
              placeholder="YYYY-MM-DD"
              onPress={() =>
                openOptionPicker("체성분 날짜 선택", dateOptions, bodyMetricDate, (value) => {
                  setBodyMetricDate(value);
                  closeOptionPicker();
                })
              }
            />
            <PickerField
              label="체중(kg)"
              value={weightForm}
              placeholder="예: 70.0"
              onPress={() =>
                openOptionPicker("체중 선택", weightOptions, weightForm, (value) => {
                  setWeightForm(value);
                  closeOptionPicker();
                })
              }
            />
            <PickerField
              label="체지방(%)"
              value={bodyFatForm}
              placeholder="예: 18.5"
              onPress={() =>
                openOptionPicker("체지방 선택", bodyFatOptions, bodyFatForm, (value) => {
                  setBodyFatForm(value);
                  closeOptionPicker();
                })
              }
            />
            <Pressable style={[styles.primaryButton, styles.actionGap]} onPress={saveBodyMetric}>
              <Text style={styles.primaryButtonText}>체성분 저장</Text>
            </Pressable>

            <Text style={[styles.sectionTitle, styles.actionGap]}>운동 기록 목록</Text>
            <View style={styles.recordList}>
              {day.workoutLogs.filter((item) => !item.isDeleted).length === 0 ? (
                <Text style={styles.hint}>기록된 운동이 없습니다.</Text>
              ) : (
                day.workoutLogs
                  .filter((item) => !item.isDeleted)
                  .map((item) => (
                    <View key={item.id} style={styles.recordListItem}>
                      <View style={styles.recordListTextBlock}>
                        <Text style={styles.recordListTitle}>
                          {item.workoutSlot
                            ? `${workoutSlots.find((slot) => slot.value === item.workoutSlot)?.label ?? item.workoutSlot} ${
                                item.completed === false ? "안함" : "함"
                              }`
                            : item.exerciseName}
                        </Text>
                        <Text style={styles.hint}>
                          {item.exerciseName} / {item.bodyPart} / {item.purpose} / {item.tool} / {item.durationMinutes ?? 30}분
                        </Text>
                      </View>
                      <Pressable style={styles.secondaryButton} onPress={() => void deleteWorkoutLog(item.id)}>
                        <Text style={styles.secondaryButtonText}>삭제</Text>
                      </Pressable>
                    </View>
                  ))
              )}
            </View>

            <Text style={[styles.sectionTitle, styles.actionGap]}>체성분 목록</Text>
            <View style={styles.recordList}>
              {day.bodyMetrics.filter((item) => !item.isDeleted).length === 0 ? (
                <Text style={styles.hint}>기록된 체성분이 없습니다.</Text>
              ) : (
                day.bodyMetrics
                  .filter((item) => !item.isDeleted)
                  .map((item) => (
                    <View key={item.id} style={styles.recordListItem}>
                      <View style={styles.recordListTextBlock}>
                        <Text style={styles.recordListTitle}>{formatDateLabel(item.date)}</Text>
                        <Text style={styles.hint}>
                          체중 {item.weightKg ?? "--"}kg / 체지방 {item.bodyFatPct ?? "--"}%
                        </Text>
                      </View>
                      <Pressable style={styles.secondaryButton} onPress={() => void deleteBodyMetric(item.id)}>
                        <Text style={styles.secondaryButtonText}>삭제</Text>
                      </Pressable>
                    </View>
                  ))
              )}
            </View>
          </View>
        ) : null}

        {tab === "settings" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>설정</Text>

            <Text style={styles.sectionTitle}>목표</Text>
            <PickerField
              label="주간 목표"
              value={goalTarget}
              placeholder="예: 4"
              onPress={() =>
                openOptionPicker("주간 목표 선택", weeklyTargetOptions, goalTarget, (value) => {
                  setGoalDraftDirty(true);
                  setGoalTarget(value);
                  closeOptionPicker();
                })
              }
            />
            <PickerField
              label="목표 체중"
              value={goalWeight}
              placeholder="목표 체중(kg)"
              onPress={() =>
                openOptionPicker("목표 체중 선택", weightOptions, goalWeight, (value) => {
                  setGoalDraftDirty(true);
                  setGoalWeight(value);
                  closeOptionPicker();
                })
              }
            />
            <PickerField
              label="목표 체지방"
              value={goalFat}
              placeholder="목표 체지방(%)"
              onPress={() =>
                openOptionPicker("목표 체지방 선택", bodyFatOptions, goalFat, (value) => {
                  setGoalDraftDirty(true);
                  setGoalFat(value);
                  closeOptionPicker();
                })
              }
            />
            <PickerField
              label="D-Day"
              value={goalDday}
              placeholder="YYYY-MM-DD"
              onPress={() =>
                openOptionPicker("D-Day 선택", ddayOptions, goalDday, (value) => {
                  setGoalDraftDirty(true);
                  setGoalDday(value);
                  closeOptionPicker();
                })
              }
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
            <Pressable style={[styles.primaryButton, styles.actionGap]} onPress={createMealTemplate}>
              <Text style={styles.primaryButtonText}>식단 템플릿 추가</Text>
            </Pressable>

            <Text style={styles.hint}>등록된 식단 템플릿</Text>
            <View style={styles.templateList}>
              {mealTemplates.length === 0 ? <Text style={styles.hint}>등록된 템플릿이 없습니다.</Text> : null}
              {mealTemplates.map((template) => (
                <View key={template.id} style={styles.recordItem}>
                  {editingMealTemplateId === template.id ? (
                    <>
                      <FieldInput
                        label="템플릿명"
                        value={editingMealTemplateDraft.label}
                        onChangeText={(label) => setEditingMealTemplateDraft((prev) => ({ ...prev, label }))}
                        placeholder="템플릿 이름"
                      />
                      <View style={styles.recordActions}>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => {
                            void saveMealTemplateEdit();
                          }}
                        >
                          <Text style={styles.secondaryButtonText}>저장</Text>
                        </Pressable>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => setEditingMealTemplateId(null)}
                        >
                          <Text style={styles.secondaryButtonText}>취소</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.recordListTextBlock}>
                        <Text style={styles.recordListTitle}>{template.label}</Text>
                        <Text style={styles.hint}>{template.isActive ? "활성" : "비활성"}</Text>
                      </View>
                      <View style={styles.recordActions}>
                        {template.isActive ? (
                          <Pressable style={styles.secondaryButton} onPress={() => startMealTemplateEdit(template)}>
                            <Text style={styles.secondaryButtonText}>수정</Text>
                          </Pressable>
                        ) : null}
                        {template.isActive ? (
                          <Pressable
                            style={styles.secondaryButton}
                            onPress={() => void deactivateMealTemplate(template.id)}
                          >
                            <Text style={styles.secondaryButtonText}>비활성화</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </>
                  )}
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
            <View style={styles.templateList}>
              {workoutTemplates.length === 0 ? <Text style={styles.hint}>등록된 템플릿이 없습니다.</Text> : null}
              {workoutTemplates.map((template) => (
                <View key={template.id} style={styles.recordItem}>
                  {editingWorkoutTemplateId === template.id ? (
                    <>
                      <FieldInput
                        label="템플릿명"
                        value={editingWorkoutTemplateDraft.label}
                        onChangeText={(label) => setEditingWorkoutTemplateDraft((prev) => ({ ...prev, label }))}
                        placeholder="템플릿 이름"
                      />
                      <FieldInput
                        label="기본 시간(분)"
                        value={editingWorkoutTemplateDraft.defaultDuration}
                        onChangeText={(defaultDuration) =>
                          setEditingWorkoutTemplateDraft((prev) => ({ ...prev, defaultDuration }))
                        }
                        placeholder="30"
                        keyboardType="numeric"
                      />
                      <SelectRow
                        label="부위"
                        options={bodyPartOptions.map((item) => ({ value: item.value, label: item.label }))}
                        selected={editingWorkoutTemplateDraft.bodyPart}
                        onSelect={(value) =>
                          setEditingWorkoutTemplateDraft((prev) => ({ ...prev, bodyPart: value as BodyPart }))
                        }
                      />
                      <SelectRow
                        label="목적"
                        options={purposeOptions.map((item) => ({ value: item.value, label: item.label }))}
                        selected={editingWorkoutTemplateDraft.purpose}
                        onSelect={(value) =>
                          setEditingWorkoutTemplateDraft((prev) => ({ ...prev, purpose: value as WorkoutPurpose }))
                        }
                      />
                      <SelectRow
                        label="도구"
                        options={toolOptions.map((item) => ({ value: item.value, label: item.label }))}
                        selected={editingWorkoutTemplateDraft.tool}
                        onSelect={(value) => setEditingWorkoutTemplateDraft((prev) => ({ ...prev, tool: value as WorkoutTool }))}
                      />
                      <View style={styles.recordActions}>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => {
                            void saveWorkoutTemplateEdit();
                          }}
                        >
                          <Text style={styles.secondaryButtonText}>저장</Text>
                        </Pressable>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => setEditingWorkoutTemplateId(null)}
                        >
                          <Text style={styles.secondaryButtonText}>취소</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.recordListTextBlock}>
                        <Text style={styles.recordListTitle}>{template.label}</Text>
                        <Text style={styles.hint}>
                          {template.bodyPart} / {template.purpose} / {template.tool} /{" "}
                          {template.defaultDuration ?? 30}분 / {template.isActive ? "활성" : "비활성"}
                        </Text>
                      </View>
                      <View style={styles.recordActions}>
                        {template.isActive ? (
                          <Pressable style={styles.secondaryButton} onPress={() => startWorkoutTemplateEdit(template)}>
                            <Text style={styles.secondaryButtonText}>수정</Text>
                          </Pressable>
                        ) : null}
                        {template.isActive ? (
                          <Pressable
                            style={styles.secondaryButton}
                            onPress={() => void deactivateWorkoutTemplate(template.id)}
                          >
                            <Text style={styles.secondaryButtonText}>비활성화</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </>
                  )}
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>리마인더</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>활성화</Text>
              <View style={styles.chipRowWrap}>
                <Pressable
                  style={[styles.chip, reminder.isEnabled ? styles.chipActive : null]}
                  onPress={() => setReminder((prev) => ({ ...prev, isEnabled: true }))}
                >
                  <Text style={styles.chipText}>사용</Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, !reminder.isEnabled ? styles.chipActive : null]}
                  onPress={() => setReminder((prev) => ({ ...prev, isEnabled: false }))}
                >
                  <Text style={styles.chipText}>미사용</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>채널</Text>
              <View style={styles.chipRowWrap}>
                <Pressable
                  style={[styles.chip, reminder.channels.includes("web_in_app") ? styles.chipActive : null]}
                  onPress={() => toggleReminderChannel("web_in_app")}
                >
                  <Text style={styles.chipText}>인앱</Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, reminder.channels.includes("web_push") ? styles.chipActive : null]}
                  onPress={() => toggleReminderChannel("web_push")}
                >
                  <Text style={styles.chipText}>브라우저 푸시</Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, reminder.channels.includes("mobile_local") ? styles.chipActive : null]}
                  onPress={() => toggleReminderChannel("mobile_local")}
                >
                  <Text style={styles.chipText}>모바일 로컬</Text>
                </Pressable>
              </View>
            </View>
            <PickerField
              label="일일 알림"
              value={reminder.dailyReminderTime}
              placeholder="20:00"
              onPress={() =>
                openOptionPicker("일일 알림 시간", timeOptions, reminder.dailyReminderTime, (value) => {
                  setReminder((prev) => ({ ...prev, dailyReminderTime: value }));
                  closeOptionPicker();
                })
              }
            />
            <PickerField
              label="미기록 감지"
              value={reminder.missingLogReminderTime}
              placeholder="21:30"
              onPress={() =>
                openOptionPicker("미기록 감지 시간", timeOptions, reminder.missingLogReminderTime, (value) => {
                  setReminder((prev) => ({ ...prev, missingLogReminderTime: value }));
                  closeOptionPicker();
                })
              }
            />
            <FieldInput
              label="타임존"
              value={reminder.timezone}
              onChangeText={(value) => setReminder((prev) => ({ ...prev, timezone: value }))}
              placeholder="Asia/Seoul"
            />
            <Pressable style={[styles.primaryButton, styles.actionGap]} onPress={saveReminder}>
              <Text style={styles.primaryButtonText}>리마인더 저장</Text>
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

      <Modal visible={Boolean(optionPicker)} transparent animationType="slide" onRequestClose={closeOptionPicker}>
        <View style={styles.pickerBackdrop}>
          <Pressable style={styles.pickerBackdropDismiss} onPress={closeOptionPicker} />
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>{optionPicker?.title ?? ""}</Text>
            <FlatList
              data={optionPicker?.options ?? []}
              keyExtractor={(item) => item.value}
              style={styles.pickerList}
              contentContainerStyle={styles.pickerListContent}
              initialNumToRender={20}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.pickerOption, optionPicker?.selected === item.value && styles.pickerOptionActive]}
                  onPress={() => optionPicker?.onSelect(item.value)}
                >
                  <Text style={[styles.pickerOptionText, optionPicker?.selected === item.value && styles.pickerOptionTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
            <Pressable style={[styles.secondaryButton, styles.pickerCloseButton]} onPress={closeOptionPicker}>
              <Text style={styles.secondaryButtonText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    alignItems: "center",
    gap: spacing.md
  },
  topBarSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  topActions: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    flexWrap: "nowrap",
    justifyContent: "flex-end"
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  menuButtonText: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 18,
    fontWeight: "700"
  },
  topPrimaryButton: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  topPrimaryButtonText: {
    color: colors.brandOn,
    fontSize: 12,
    fontWeight: "700"
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 999,
  },
  menuScrim: {
    flex: 1,
    backgroundColor: "rgba(13, 22, 20, 0.2)"
  },
  menuPanel: {
    width: 280,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs
  },
  menuHeader: {
    marginBottom: spacing.sm
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary
  },
  menuItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  menuItemActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand
  },
  menuItemText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700"
  },
  menuItemTextActive: {
    color: colors.brandOn
  },
  brand: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary
  },
  dashboardRangeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  dashboardRangeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#fff"
  },
  dashboardRangeChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand
  },
  dashboardRangeChipText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700"
  },
  dashboardRangeChipTextActive: {
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
  kpiRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4
  },
  kpiLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600"
  },
  kpiValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "800"
  },
  kpiValueSmall: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700"
  },
  trendCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8
  },
  metricPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10
  },
  metricCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fbfcfd",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8
  },
  metricLatest: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  metricChartWrap: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 10
  },
  metricChart: {
    borderRadius: 10
  },
  metricRangeText: {
    color: colors.textSecondary,
    fontSize: 11
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  trendLabel: {
    width: 96,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700"
  },
  trendTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e8eeea",
    overflow: "hidden"
  },
  trendFill: {
    height: "100%",
    backgroundColor: colors.brand
  },
  trendValue: {
    width: 34,
    textAlign: "right",
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700"
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
  chipDisabled: {
    opacity: 0.45
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
  pickerInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  pickerInputText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "600"
  },
  pickerPlaceholder: {
    color: colors.textSecondary,
    fontWeight: "500"
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch"
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
  },
  templateList: {
    gap: spacing.sm
  },
  recordList: {
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  recordItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: spacing.sm
  },
  recordListItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  recordListTextBlock: {
    flex: 1,
    gap: 4
  },
  recordListTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600"
  },
  recordActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 68
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700"
  },
  pickerBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.28)"
  },
  pickerBackdropDismiss: {
    flex: 1
  },
  pickerSheet: {
    maxHeight: "72%",
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary
  },
  pickerList: {
    maxHeight: 360
  },
  pickerListContent: {
    gap: 6,
    paddingBottom: spacing.md
  },
  pickerOption: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  pickerOptionActive: {
    borderColor: colors.brand,
    backgroundColor: "#e5f5ef"
  },
  pickerOptionText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "600"
  },
  pickerOptionTextActive: {
    color: colors.brand
  },
  pickerCloseButton: {
    alignSelf: "flex-end"
  }
});
