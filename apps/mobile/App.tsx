import { StatusBar } from "expo-status-bar";
import * as React from "react";
import * as AuthSession from "expo-auth-session";
import * as Notifications from "expo-notifications";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { cardRadius, colors, spacing } from "@routinemate/ui";

type TabKey = "dashboard" | "records" | "settings";
type Session = { sessionId: string; userId: string; isGuest: boolean; email?: string; authProvider?: string };
type Dashboard = { adherenceRate: number; totalMeals: number; totalWorkouts: number; range: string; granularity: string };
type Goal = { weeklyRoutineTarget: number; targetWeightKg?: number; targetBodyFat?: number; dDay?: string };

type ReminderSettings = {
  isEnabled: boolean;
  dailyReminderTime: string;
  missingLogReminderTime: string;
  channels: string[];
  timezone: string;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://routinemate-kohl.vercel.app";
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";

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

export default function App(): React.JSX.Element {
  const [tab, setTab] = React.useState<TabKey>("dashboard");
  const [session, setSession] = React.useState<Session | null>(null);
  const [message, setMessage] = React.useState<string>("");
  const [dashboard, setDashboard] = React.useState<Dashboard | null>(null);
  const [goal, setGoal] = React.useState<Goal | null>(null);
  const [range, setRange] = React.useState<"7d" | "30d" | "90d">("7d");

  const [mealSlot, setMealSlot] = React.useState<"breakfast" | "lunch" | "dinner" | "dinner2">("lunch");
  const [mealDone, setMealDone] = React.useState(true);
  const [workoutName, setWorkoutName] = React.useState("전신 루틴");
  const [weight, setWeight] = React.useState("");
  const [bodyFat, setBodyFat] = React.useState("");

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

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  const scheduleLocalReminder = React.useCallback(
    async (title: string, body: string, hhmm: string) => {
      const [hourText, minuteText] = hhmm.split(":");
      const hour = Number(hourText);
      const minute = Number(minuteText);
      if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute
        }
      });
    },
    []
  );

  const refreshDashboard = React.useCallback(async () => {
    if (!session) {
      return;
    }
    const [dashboardData, goalData] = await Promise.all([
      apiFetch<Dashboard>(`/api/v1/dashboard?sessionId=${encodeURIComponent(session.sessionId)}&range=${range}`),
      apiFetch<{ goal: Goal | null }>(`/api/v1/goals?sessionId=${encodeURIComponent(session.sessionId)}`)
    ]);
    setDashboard(dashboardData);
    setGoal(goalData.goal ?? null);
  }, [range, session]);

  React.useEffect(() => {
    void refreshDashboard().catch((error) => setMessage(error instanceof Error ? error.message : "조회 실패"));
  }, [refreshDashboard]);

  async function startGuest() {
    try {
      const next = await apiFetch<Session>("/api/v1/auth/guest", { method: "POST", body: JSON.stringify({}) });
      setSession(next);
      setMessage("게스트 세션을 시작했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게스트 세션 실패");
    }
  }

  async function saveMealCheckin() {
    if (!session) {
      setMessage("먼저 세션을 시작해 주세요.");
      return;
    }
    try {
      await apiFetch("/api/v1/meal-checkins", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.sessionId,
          date: today,
          slot: mealSlot,
          completed: mealDone
        })
      });
      setMessage("식단 체크인을 저장했습니다.");
      void refreshDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "식단 저장 실패");
    }
  }

  async function saveWorkout() {
    if (!session) {
      setMessage("먼저 세션을 시작해 주세요.");
      return;
    }
    try {
      await apiFetch("/api/v1/workout-logs/quick", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.sessionId,
          date: today,
          bodyPart: "full_body",
          purpose: "fat_loss",
          tool: "bodyweight",
          exerciseName: workoutName || "전신 루틴",
          durationMinutes: 30,
          intensity: "medium"
        })
      });
      setMessage("운동을 저장했습니다.");
      void refreshDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "운동 저장 실패");
    }
  }

  async function saveBodyMetric() {
    if (!session) {
      setMessage("먼저 세션을 시작해 주세요.");
      return;
    }
    try {
      await apiFetch("/api/v1/body-metrics", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.sessionId,
          date: today,
          ...(weight ? { weightKg: Number(weight) } : {}),
          ...(bodyFat ? { bodyFatPct: Number(bodyFat) } : {})
        })
      });
      setMessage("체성분을 저장했습니다.");
      void refreshDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "체성분 저장 실패");
    }
  }

  async function saveGoal() {
    if (!session) {
      setMessage("먼저 세션을 시작해 주세요.");
      return;
    }
    try {
      await apiFetch("/api/v1/goals", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.sessionId,
          weeklyRoutineTarget: Number(goalTarget || "4"),
          ...(goalWeight ? { targetWeightKg: Number(goalWeight) } : {}),
          ...(goalFat ? { targetBodyFat: Number(goalFat) } : {}),
          ...(goalDday ? { dDay: goalDday } : {})
        })
      });
      setMessage("목표를 저장했습니다.");
      void refreshDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "목표 저장 실패");
    }
  }

  async function saveReminder() {
    if (!session) {
      setMessage("먼저 세션을 시작해 주세요.");
      return;
    }
    try {
      await apiFetch("/api/v1/reminders/settings", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.sessionId,
          ...reminder
        })
      });
      await Notifications.requestPermissionsAsync();
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (reminder.isEnabled && reminder.channels.includes("mobile_local")) {
        await scheduleLocalReminder("RoutineMate 리마인더", "오늘 루틴을 기록해 주세요.", reminder.dailyReminderTime);
        await scheduleLocalReminder(
          "RoutineMate 미기록 감지",
          "아직 오늘 기록이 없습니다. 1탭으로 체크인해 주세요.",
          reminder.missingLogReminderTime
        );
      }
      setMessage("리마인더 설정을 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "리마인더 저장 실패");
    }
  }

  async function upgradeGoogleMobile() {
    try {
      if (!GOOGLE_ANDROID_CLIENT_ID) {
        setMessage("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID가 필요합니다.");
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
        setMessage("Google 인증이 취소되었거나 실패했습니다.");
        return;
      }

      const endpoint = session ? "/api/v1/auth/upgrade/google" : "/api/v1/auth/google/session";
      const upgraded = await apiFetch<Session>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          ...(session ? { sessionId: session.sessionId } : {}),
          idToken: authResult.params.id_token,
          platform: "android"
        })
      });
      setSession(upgraded);
      setMessage("Google 계정 연동이 완료되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google 전환 실패");
    }
  }

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
          <Pressable key={key} style={[styles.tabButton, tab === key && styles.tabButtonActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {message ? <Text style={styles.info}>{message}</Text> : null}
        <Text style={styles.hint}>세션: {session ? `${session.sessionId.slice(0, 10)}...` : "없음"}</Text>

        {tab === "dashboard" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>대시보드</Text>
            <View style={styles.row}>
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
            <Text style={styles.hint}>현재 목표: 주 {goal?.weeklyRoutineTarget ?? 0}회</Text>
          </View>
        ) : null}

        {tab === "records" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>기록</Text>
            <Text style={styles.hint}>식단 체크인</Text>
            <View style={styles.row}>
              {([
                ["breakfast", "아침"],
                ["lunch", "점심"],
                ["dinner", "저녁"],
                ["dinner2", "저녁2"]
              ] as Array<["breakfast" | "lunch" | "dinner" | "dinner2", string]>).map(([value, label]) => (
                <Pressable key={value} style={[styles.chip, mealSlot === value && styles.chipActive]} onPress={() => setMealSlot(value)}>
                  <Text style={styles.chipText}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Pressable style={[styles.chip, mealDone && styles.chipActive]} onPress={() => setMealDone(true)}>
                <Text style={styles.chipText}>함</Text>
              </Pressable>
              <Pressable style={[styles.chip, !mealDone && styles.chipActive]} onPress={() => setMealDone(false)}>
                <Text style={styles.chipText}>안함</Text>
              </Pressable>
            </View>
            <Pressable style={styles.primaryButton} onPress={saveMealCheckin}>
              <Text style={styles.primaryButtonText}>식단 저장</Text>
            </Pressable>

            <Text style={styles.hint}>운동 Quick Log</Text>
            <TextInput style={styles.input} value={workoutName} onChangeText={setWorkoutName} placeholder="운동명" />
            <Pressable style={styles.primaryButton} onPress={saveWorkout}>
              <Text style={styles.primaryButtonText}>운동 저장</Text>
            </Pressable>

            <Text style={styles.hint}>체중/체지방</Text>
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.half]} value={weight} onChangeText={setWeight} placeholder="체중" keyboardType="numeric" />
              <TextInput style={[styles.input, styles.half]} value={bodyFat} onChangeText={setBodyFat} placeholder="체지방" keyboardType="numeric" />
            </View>
            <Pressable style={styles.primaryButton} onPress={saveBodyMetric}>
              <Text style={styles.primaryButtonText}>체성분 저장</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "settings" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>설정</Text>
            <Text style={styles.hint}>목표</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.half]}
                value={goalTarget}
                onChangeText={setGoalTarget}
                placeholder="주간 목표"
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, styles.half]}
                value={goalDday}
                onChangeText={setGoalDday}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.half]} value={goalWeight} onChangeText={setGoalWeight} placeholder="목표 체중" keyboardType="numeric" />
              <TextInput style={[styles.input, styles.half]} value={goalFat} onChangeText={setGoalFat} placeholder="목표 체지방" keyboardType="numeric" />
            </View>
            <Pressable style={styles.primaryButton} onPress={saveGoal}>
              <Text style={styles.primaryButtonText}>목표 저장</Text>
            </Pressable>

            <Text style={styles.hint}>리마인더</Text>
            <TextInput
              style={styles.input}
              value={reminder.dailyReminderTime}
              onChangeText={(value) => setReminder((prev) => ({ ...prev, dailyReminderTime: value }))}
              placeholder="일일 알림 HH:MM"
            />
            <TextInput
              style={styles.input}
              value={reminder.missingLogReminderTime}
              onChangeText={(value) => setReminder((prev) => ({ ...prev, missingLogReminderTime: value }))}
              placeholder="미기록 감지 HH:MM"
            />
            <Pressable style={styles.primaryButton} onPress={saveReminder}>
              <Text style={styles.primaryButtonText}>리마인더 저장</Text>
            </Pressable>

            <Text style={styles.hint}>계정 전환</Text>
            <Pressable style={styles.primaryButton} onPress={upgradeGoogleMobile}>
              <Text style={styles.primaryButtonText}>Google로 계정 전환</Text>
            </Pressable>
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
    paddingVertical: 8,
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
  sectionTitle: {
    fontSize: 22,
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
    color: colors.brand
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
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
    fontSize: 14,
    flex: 1
  },
  half: {
    minWidth: 130
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  primaryButtonText: {
    color: colors.brandOn,
    fontWeight: "700",
    fontSize: 15
  }
});
