import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { AdmissionDocumentBox } from "@/components/admission-document-box";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import {
  ADMISSION_DOCUMENT_KIND_LABELS,
  ADMISSION_DOCUMENT_KINDS,
  fetchAdmissionDocuments,
  type AdmissionDocumentRecord,
} from "@/lib/documentos-api";
import { fetchOnboardingTasks, toggleOnboardingTask, type OnboardingTaskRecord } from "@/lib/onboarding-api";
import { getSessionToken } from "@/lib/session";

export default function OnboardingScreen() {
  const theme = useTheme();
  const [tasks, setTasks] = useState<OnboardingTaskRecord[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [admissionDocuments, setAdmissionDocuments] = useState<AdmissionDocumentRecord[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const [tasksResult, documentsResult] = await Promise.all([
          fetchOnboardingTasks(token),
          fetchAdmissionDocuments(token),
        ]);
        if (cancelled) return;
        if (tasksResult) {
          setTasks(tasksResult.tasks);
          setDone(new Set(tasksResult.completedTaskIds));
        }
        if (documentsResult) setAdmissionDocuments(documentsResult);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function toggle(id: string) {
    const token = await getSessionToken();
    if (!token) return;
    const result = await toggleOnboardingTask(token, id);
    if (!result) return;
    setDone((current) => {
      const next = new Set(current);
      if (result.completed) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const uploadTask = tasks.find((task) => task.requiresUpload);
  const byKind = new Map(
    admissionDocuments.filter((doc) => doc.kind).map((doc) => [doc.kind as string, doc]),
  );

  const progress = tasks.length > 0 ? done.size / tasks.length : 0;

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Boas-vindas" />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="default" themeColor="textSecondary">
          Complete os passos abaixo antes do seu primeiro dia.
        </ThemedText>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.secondary, width: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {done.size} de {tasks.length} concluídos
        </ThemedText>

        <View style={styles.list}>
          {tasks.map((task) => {
            const checked = done.has(task.id);
            const expanded = expandedTaskId === task.id;
            return (
              <View key={task.id} style={styles.taskGroup}>
                <Pressable
                  onPress={() =>
                    task.requiresUpload
                      ? setExpandedTaskId(expanded ? null : task.id)
                      : toggle(task.id)
                  }
                  style={[styles.row, { backgroundColor: theme.backgroundElement }]}
                >
                  <Ionicons
                    name={checked ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={checked ? theme.success : theme.textSecondary}
                  />
                  <View style={styles.rowContent}>
                    <ThemedText type="smallBold" style={checked ? styles.strikethrough : undefined}>
                      {task.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {task.description}
                    </ThemedText>
                  </View>
                  <Ionicons name={task.icon as keyof typeof Ionicons.glyphMap} size={20} color={theme.secondary} />
                </Pressable>

                {task.requiresUpload && expanded ? (
                  <View style={styles.list}>
                    {ADMISSION_DOCUMENT_KINDS.map((kind) => (
                      <AdmissionDocumentBox
                        key={kind}
                        kind={kind}
                        label={ADMISSION_DOCUMENT_KIND_LABELS[kind]}
                        existing={byKind.get(kind) ?? null}
                        onSubmitted={(created) => {
                          setAdmissionDocuments((current) => [
                            created,
                            ...current.filter((d) => d.kind !== kind),
                          ]);
                          if (uploadTask) setDone((current) => new Set(current).add(uploadTask.id));
                        }}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
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
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  list: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  taskGroup: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderRadius: 14,
    padding: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
});
