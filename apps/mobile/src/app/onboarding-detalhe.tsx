import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import {
  fetchTeamOnboardingProgress,
  grantOnboardingFullAccess,
  type TeamOnboardingProgress,
} from "@/lib/onboarding-api";
import { getSessionToken } from "@/lib/session";

function grantLabel(entry: TeamOnboardingProgress): string {
  if (!entry.fullAccessGrantedAt) return "Liberar acesso total ao SGP Portal";
  if (entry.fullAccessGrantSource === "manual" && entry.fullAccessGrantedByName) {
    return `Liberado manualmente por ${entry.fullAccessGrantedByName}`;
  }
  return "Acesso liberado automaticamente";
}

export default function OnboardingDetalheScreen() {
  const theme = useTheme();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [entry, setEntry] = useState<TeamOnboardingProgress | null>(null);
  const [granting, setGranting] = useState(false);

  const load = useCallback(async () => {
    const token = await getSessionToken();
    if (!token) return;
    const result = await fetchTeamOnboardingProgress(token);
    if (result) setEntry(result.find((item) => item.userId === userId) ?? null);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  async function handleGrant() {
    if (!entry) return;
    const token = await getSessionToken();
    if (!token) return;
    setGranting(true);
    try {
      await grantOnboardingFullAccess(token, entry.userId);
      await load();
    } finally {
      setGranting(false);
    }
  }

  function confirmGrant() {
    if (!entry) return;
    const complete = entry.totalCount > 0 && entry.completedCount === entry.totalCount;
    Alert.alert(
      `Liberar acesso total ao SGP Portal para ${entry.userName}?`,
      complete
        ? `${entry.userName} concluiu todas as etapas do onboarding — essa ação libera o acesso completo ao portal.`
        : `${entry.userName} ainda não completou o onboarding (${entry.completedCount} de ${entry.totalCount}). Essa é uma exceção manual — o colaborador ganha acesso completo ao portal mesmo assim.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar liberação", onPress: handleGrant },
      ],
    );
  }

  if (!entry) {
    return (
      <ThemedView style={styles.container}>
        <ScreenHeader title="Onboarding" />
      </ThemedView>
    );
  }

  const completedSet = new Set(entry.completedTaskIds);

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title={entry.userName} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.list}>
          {entry.tasks.map((task) => {
            const done = completedSet.has(task.id);
            return (
              <View key={task.id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.rowContent}>
                  <ThemedText type="smallBold">{task.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {task.description}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor={done ? "success" : "textSecondary"}>
                  {done ? "Concluída" : "Pendente"}
                </ThemedText>
              </View>
            );
          })}
        </View>
        <ThemedButton
          title={granting ? "Liberando..." : grantLabel(entry)}
          onPress={granting || entry.fullAccessGrantedAt ? () => {} : confirmGrant}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    borderRadius: 14,
    padding: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
});
