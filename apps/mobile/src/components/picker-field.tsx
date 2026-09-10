import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "./themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

// A native <select> has no React Native equivalent — this is a small
// dependency-free stand-in (Pressable trigger + a Modal list) rather than
// pulling in a picker library, matching this screen's existing modal
// patterns (photo source, change password).
export function PickerField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "—";

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        accessibilityLabel={label}
        style={[styles.trigger, { backgroundColor: theme.backgroundElement }]}
        onPress={() => setOpen(true)}
      >
        <ThemedText type="small">{selectedLabel}</ThemedText>
        <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.listCard, { backgroundColor: theme.backgroundElement }]}
            onPress={(event) => event.stopPropagation()}
          >
            <FlatList
              data={[{ value: "", label: "—" }, ...options]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value || null);
                    setOpen(false);
                  }}
                >
                  <ThemedText type="small">{item.label}</ThemedText>
                  {item.value === (value ?? "") ? (
                    <Ionicons name="checkmark" size={16} color={theme.accent} />
                  ) : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  listCard: {
    width: "100%",
    maxWidth: 320,
    maxHeight: "70%",
    borderRadius: 16,
    paddingVertical: Spacing.two,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
});
