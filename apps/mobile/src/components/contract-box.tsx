import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as WebBrowser from "expo-web-browser";

import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { WEB_APP_URL } from "@/constants/api";
import { submitSignedContract, type SignedContractRecord } from "@/lib/documentos-api";
import { getSessionToken } from "@/lib/session";

// Shared by the Documentos "Contrato" tab and the Onboarding "Assinar o
// contrato" task embed, same reuse shape as AdmissionDocumentBox.
export function ContractBox({
  existing,
  onSubmitted,
}: {
  existing: SignedContractRecord | null;
  onSubmitted?: () => void;
}) {
  const theme = useTheme();
  const [submitting, setSubmitting] = useState(false);

  async function handlePickAndSubmit() {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (result.canceled || !result.assets?.[0]) return;
    const token = await getSessionToken();
    if (!token) return;

    setSubmitting(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const submitted = await submitSignedContract(token, `data:application/pdf;base64,${base64}`);
      if (submitted) onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.form, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">Contrato de trabalho</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {existing?.submittedAt
          ? `Enviado em ${new Date(existing.submittedAt).toLocaleDateString("pt-BR")}`
          : "Nenhum contrato assinado enviado ainda."}
      </ThemedText>
      <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_APP_URL}/documents/contrato-modelo.pdf`)}>
        <ThemedText type="small" themeColor="secondary">
          Baixar modelo do contrato
        </ThemedText>
      </Pressable>
      <ThemedButton
        title={submitting ? "Enviando..." : existing?.submittedAt ? "Reenviar" : "Enviar PDF assinado"}
        onPress={submitting ? () => {} : handlePickAndSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
