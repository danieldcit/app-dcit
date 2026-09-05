import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { StatusBadge } from "@/components/status-badge";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Elevation, Spacing } from "@/constants/theme";
import { pickPhoto } from "@/lib/photo-picker";
import { readPhotoAsDataUrl } from "@/lib/photo-data-url";
import { getSessionToken } from "@/lib/session";
import {
  ADMISSION_DOCUMENT_MAX_PHOTOS,
  submitAdmissionDocument,
  type AdmissionDocumentKind,
  type AdmissionDocumentRecord,
} from "@/lib/documentos-api";
import type { DocumentStatus } from "@/lib/documentos";

// One fixed document type (RG, CPF, ...) — upload + current status live in
// the same box; resubmitting replaces the whole photo set and puts the
// document back to "enviado" (see DocumentosService.createAdmissionDocument).
// Shared by the Documentos "Admissionais" tab and the Onboarding "Enviar
// documentos" task, which post to the exact same endpoint.
export function AdmissionDocumentBox({
  kind,
  label,
  existing,
  onSubmitted,
}: {
  kind: AdmissionDocumentKind;
  label: string;
  existing: AdmissionDocumentRecord | null;
  onSubmitted: (doc: AdmissionDocumentRecord) => void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const atMax = photoUris.length >= ADMISSION_DOCUMENT_MAX_PHOTOS;

  function resetPhotos() {
    setPhotoUris([]);
  }

  async function handlePickPhoto(source: "camera" | "library") {
    if (atMax) return;
    const uri = await pickPhoto(source);
    if (!uri) return;
    setPhotoUris((current) => [...current, uri]);
  }

  function removePhoto(index: number) {
    setPhotoUris((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (photoUris.length === 0) {
      Alert.alert("Foto obrigatória", "Tire ao menos uma foto antes de enviar.");
      return;
    }
    const token = await getSessionToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const photos = await Promise.all(photoUris.map((uri) => readPhotoAsDataUrl(uri)));
      const created = await submitAdmissionDocument(token, { kind, photos });
      if (created) {
        onSubmitted(created);
        resetPhotos();
        setExpanded(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View
      testID={`admission-box-${kind}`}
      style={[styles.form, { backgroundColor: theme.backgroundElement }, Elevation.card]}
    >
      <View style={styles.boxHeader}>
        <View style={styles.rowContent}>
          <ThemedText type="smallBold">{label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {existing
              ? `Enviado em ${new Date(existing.submittedAt).toLocaleDateString("pt-BR")}`
              : "Nenhum documento enviado ainda."}
          </ThemedText>
        </View>
        {existing ? <StatusBadge status={existing.status as DocumentStatus} /> : null}
      </View>

      <ThemedButton
        title={expanded ? "Cancelar" : existing ? "Reenviar" : "Enviar"}
        onPress={() => {
          if (expanded) resetPhotos();
          setExpanded((value) => !value);
        }}
      />

      {expanded ? (
        <View style={styles.list}>
          <ThemedText type="small" themeColor="textSecondary">
            {`Fotos (até ${ADMISSION_DOCUMENT_MAX_PHOTOS}) — ${photoUris.length}/${ADMISSION_DOCUMENT_MAX_PHOTOS}`}
          </ThemedText>
          <View style={styles.photoButtons}>
            <Pressable
              style={[styles.photoButton, { backgroundColor: theme.background, opacity: atMax ? 0.5 : 1 }]}
              disabled={atMax}
              onPress={() => handlePickPhoto("camera")}
            >
              <Ionicons name="camera-outline" size={20} color={theme.secondary} />
              <ThemedText type="small">Tirar foto</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.photoButton, { backgroundColor: theme.background, opacity: atMax ? 0.5 : 1 }]}
              disabled={atMax}
              onPress={() => handlePickPhoto("library")}
            >
              <Ionicons name="image-outline" size={20} color={theme.secondary} />
              <ThemedText type="small">Escolher da galeria</ThemedText>
            </Pressable>
          </View>
          {photoUris.length > 0 ? (
            <View style={styles.photoPreviewRow}>
              {photoUris.map((uri, index) => (
                <Pressable key={index} onPress={() => removePhoto(index)}>
                  <Image source={{ uri }} style={styles.previewSmall} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          ) : null}
          <ThemedButton
            title={submitting ? "Enviando..." : "Enviar"}
            onPress={submitting ? () => {} : handleSubmit}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  boxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  list: {
    gap: Spacing.two,
  },
  photoButtons: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  photoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    borderRadius: 12,
    paddingVertical: Spacing.three,
  },
  photoPreviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  previewSmall: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },
});
