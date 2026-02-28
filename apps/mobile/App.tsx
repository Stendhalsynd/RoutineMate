import { StatusBar } from "expo-status-bar";
import * as React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { cardRadius, colors, spacing } from "@routinemate/ui";

type ProgressCard = {
  id: string;
  title: string;
  completed: number;
  total: number;
};

const cards: ProgressCard[] = [
  { id: "water", title: "Hydration", completed: 5, total: 8 },
  { id: "focus", title: "Focus Sessions", completed: 2, total: 4 },
  { id: "walk", title: "Evening Walk", completed: 1, total: 1 }
];

export default function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>RoutineMate</Text>
        <Text style={styles.subheading}>Quick log first, details second.</Text>

        <Pressable style={styles.quickLogButton} accessibilityRole="button">
          <Text style={styles.quickLogTitle}>+ Quick Log</Text>
          <Text style={styles.quickLogHint}>Tap to record your latest routine action</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Today Progress</Text>
        {cards.map((card) => {
          const percent = Math.round((card.completed / card.total) * 100);
          return (
            <View key={card.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardCount}>
                  {card.completed}/{card.total}
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${percent}%` }]} />
              </View>
              <Text style={styles.percent}>{percent}% complete</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary
  },
  subheading: {
    fontSize: 15,
    color: colors.textSecondary
  },
  quickLogButton: {
    backgroundColor: colors.brand,
    borderRadius: cardRadius,
    padding: spacing.md
  },
  quickLogTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.brandOn
  },
  quickLogHint: {
    fontSize: 13,
    marginTop: 4,
    color: colors.brandOn
  },
  sectionTitle: {
    marginTop: spacing.sm,
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: cardRadius,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary
  },
  cardCount: {
    fontSize: 14,
    color: colors.textSecondary
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    backgroundColor: colors.brand
  },
  percent: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textSecondary
  }
});
