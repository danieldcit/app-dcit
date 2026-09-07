import { Modal, Pressable, StyleSheet, View } from "react-native";

import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

export function OnboardingCelebrationModal({
  visible,
  title,
  description,
  actionLabel,
  onAction,
}: {
  visible: boolean;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onAction}>
      <Pressable style={styles.backdrop} onPress={onAction}>
        <Pressable style={[styles.card, { backgroundColor: theme.backgroundElement }]} onPress={(e) => e.stopPropagation()}>
          <ThemedText type="subtitle" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
            {description}
          </ThemedText>
          <ThemedButton title={actionLabel} onPress={onAction} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: "center",
    gap: Spacing.three,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
  },
  description: {
    textAlign: "center",
  },
});
