import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { ONBOARDING_ACCESS_ITEMS, ONBOARDING_ACCESS_ITEM_LABELS } from "@/lib/onboarding-api";

// Each item toggles independently — the outer "Configurar seus acessos"
// task completes on its own once every item here is done (derived
// server-side), same as the web version's AccessChecklistSection. The
// whole row is the tap target (not just the status pill) so it matches
// this app's existing list-row convention (e.g. onboarding task rows) —
// @testing-library/react-native's fireEvent.press bubbles from a pressed
// Text node up to its nearest Pressable ancestor, so the label and the
// pill both need to sit inside the same Pressable to be tappable via either.
export function AccessChecklistSection({
  completedItems,
  pendingItem,
  onToggleItem,
}: {
  completedItems: string[];
  pendingItem: string | null;
  onToggleItem: (item: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {ONBOARDING_ACCESS_ITEMS.map((item) => {
        const isDone = completedItems.includes(item);
        return (
          <Pressable
            key={item}
            disabled={pendingItem === item}
            onPress={() => onToggleItem(item)}
            style={[styles.row, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="small">{ONBOARDING_ACCESS_ITEM_LABELS[item]}</ThemedText>
            <View style={[styles.badge, { backgroundColor: isDone ? theme.success : theme.textSecondary }]}>
              <ThemedText type="small" style={{ color: theme.onAccent }}>
                {isDone ? "Concluído" : "Pendente"}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: Spacing.three,
  },
  badge: {
    borderRadius: 8,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
});
