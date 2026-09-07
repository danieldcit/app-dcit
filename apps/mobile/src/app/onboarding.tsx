import { useCallback, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { AccessChecklistSection } from "@/components/access-checklist-section";
import { AdmissionDocumentBox } from "@/components/admission-document-box";
import { ContractBox } from "@/components/contract-box";
import { OnboardingCelebrationModal } from "@/components/onboarding-celebration-modal";
import { ScreenHeader } from "@/components/screen-header";
import { TeamSection } from "@/components/team-section";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { WelcomeVideoPlayer } from "@/components/welcome-video-player";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import {
  ADMISSION_DOCUMENT_KIND_LABELS,
  ADMISSION_DOCUMENT_KINDS,
  fetchAdmissionDocuments,
  fetchSignedContract,
  type AdmissionDocumentRecord,
  type SignedContractRecord,
} from "@/lib/documentos-api";
import {
  fetchOnboardingTasks,
  toggleOnboardingAccessItem,
  toggleOnboardingTask,
  type OnboardingTaskRecord,
} from "@/lib/onboarding-api";
import { getSessionToken } from "@/lib/session";

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [tasks, setTasks] = useState<OnboardingTaskRecord[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [completedAccessItems, setCompletedAccessItems] = useState<string[]>([]);
  const [fullAccessGrantedAt, setFullAccessGrantedAt] = useState<string | null>(null);
  const [admissionDocuments, setAdmissionDocuments] = useState<AdmissionDocumentRecord[]>([]);
  const [signedContract, setSignedContract] = useState<SignedContractRecord>({ submittedAt: null });
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [pendingAccessItem, setPendingAccessItem] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const previousIsComplete = useRef(false);
  const previousGrantedAt = useRef<string | null>(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showUnlockedDialog, setShowUnlockedDialog] = useState(false);

  const load = useCallback(async () => {
    const token = await getSessionToken();
    if (!token) return;
    const [tasksResult, documentsResult, contractResult] = await Promise.all([
      fetchOnboardingTasks(token),
      fetchAdmissionDocuments(token),
      fetchSignedContract(token),
    ]);
    if (tasksResult) {
      setTasks(tasksResult.tasks);
      setDone(new Set(tasksResult.completedTaskIds));
      setCompletedAccessItems(tasksResult.completedAccessItems);

      const isComplete = tasksResult.tasks.length > 0 && tasksResult.completedTaskIds.length === tasksResult.tasks.length;
      if (!previousIsComplete.current && isComplete && !tasksResult.fullAccessGrantedAt) {
        setShowCompletionDialog(true);
      }
      previousIsComplete.current = isComplete;

      if (!previousGrantedAt.current && tasksResult.fullAccessGrantedAt) {
        setShowUnlockedDialog(true);
      }
      previousGrantedAt.current = tasksResult.fullAccessGrantedAt;
      setFullAccessGrantedAt(tasksResult.fullAccessGrantedAt);
    }
    if (documentsResult) setAdmissionDocuments(documentsResult);
    if (contractResult) setSignedContract(contractResult);
  }, []);

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

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

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
    await load();
  }

  async function toggleAccessItem(item: string) {
    const token = await getSessionToken();
    if (!token) return;
    setPendingAccessItem(item);
    try {
      const result = await toggleOnboardingAccessItem(token, item);
      if (result) {
        setCompletedAccessItems((current) =>
          result.completed ? [...current, item] : current.filter((i) => i !== item),
        );
      }
    } finally {
      setPendingAccessItem(null);
    }
    await load();
  }

  const uploadTask = tasks.find((task) => task.requiresUpload);
  const byKind = new Map(
    admissionDocuments.filter((doc) => doc.kind).map((doc) => [doc.kind as string, doc]),
  );

  const progress = tasks.length > 0 ? done.size / tasks.length : 0;

  function isExpandable(task: OnboardingTaskRecord) {
    return task.requiresUpload || task.requiresVideo || task.showsTeam || task.requiresContract || task.requiresAccessChecklist;
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Boas-vindas" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl testID="onboarding-refresh-control" refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <ThemedText type="default" themeColor="textSecondary">
          Complete os passos abaixo antes do seu primeiro dia.
        </ThemedText>

        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { backgroundColor: theme.secondary, width: `${Math.round(progress * 100)}%` }]}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {done.size} de {tasks.length} concluídos
        </ThemedText>

        <View style={styles.list}>
          {tasks.map((task) => {
            const checked = done.has(task.id);
            const expanded = expandedTaskId === task.id;
            const expandable = isExpandable(task);
            return (
              <View key={task.id} style={styles.taskGroup}>
                <Pressable
                  onPress={() => (expandable ? setExpandedTaskId(expanded ? null : task.id) : toggle(task.id))}
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
                          setAdmissionDocuments((current) => [created, ...current.filter((d) => d.kind !== kind)]);
                          if (uploadTask) setDone((current) => new Set(current).add(uploadTask.id));
                        }}
                      />
                    ))}
                  </View>
                ) : null}

                {task.requiresVideo && expanded ? (
                  <WelcomeVideoPlayer onCompleted={() => !checked && toggle(task.id)} />
                ) : null}

                {task.showsTeam && expanded ? (
                  <TeamSection isDone={checked} pending={false} onToggle={() => toggle(task.id)} />
                ) : null}

                {task.requiresContract && expanded ? (
                  <ContractBox existing={signedContract} onSubmitted={() => !checked && toggle(task.id)} />
                ) : null}

                {task.requiresAccessChecklist && expanded ? (
                  <AccessChecklistSection
                    completedItems={completedAccessItems}
                    pendingItem={pendingAccessItem}
                    onToggleItem={toggleAccessItem}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <OnboardingCelebrationModal
        visible={showCompletionDialog}
        title="🎉 Parabéns! Onboarding concluído"
        description="Aguarde o gestor ou RH liberar seu acesso completo ao portal."
        actionLabel="Fechar"
        onAction={() => setShowCompletionDialog(false)}
      />
      <OnboardingCelebrationModal
        visible={showUnlockedDialog}
        title="🎉 Acesso liberado!"
        description="Seu acesso total ao SGP Portal foi liberado."
        actionLabel="Ir para o Dashboard"
        onAction={() => {
          setShowUnlockedDialog(false);
          router.replace("/(tabs)");
        }}
      />
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
