import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { DOCUMENT_STATUS_LABEL, type DocumentStatus } from "@/lib/documentos";

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const theme = useTheme();
  const color: Record<DocumentStatus, string> = {
    enviado: theme.secondary,
    em_analise: theme.secondary,
    aprovado: theme.success,
    recusado: theme.accent,
  };
  return (
    <View style={[styles.statusBadge, { backgroundColor: color[status] }]}>
      <ThemedText type="small" style={{ color: theme.onAccent }}>
        {DOCUMENT_STATUS_LABEL[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBadge: {
    borderRadius: 8,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
});
