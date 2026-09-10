import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useLocaleContext } from "@/context/locale-context";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { decodeSessionToken, type SessionClaims } from "@/lib/jwt";
import { unregisterPushNotifications } from "@/lib/push";
import { clearSessionToken, getSessionToken } from "@/lib/session";
import { useNotificationContext } from "@/context/notification-context";
import { changePassword as submitChangePassword } from "@/lib/account-api";
import { fetchMyAvatar, removeMyAvatar, updateMyAvatar } from "@/lib/avatar-api";
import { pickPhoto } from "@/lib/photo-picker";
import { readPhotoAsDataUrl } from "@/lib/photo-data-url";
import { PersonalDataModal } from "@/components/personal-data-modal";

const ROLE_SOURCE_LABEL: Record<SessionClaims["role"], string> = {
  colaborador: "Colaborador",
  gestor: "Gestor",
  rh: "RH",
};

export default function PerfilScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { reset: resetNotifications } = useNotificationContext();
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarPending, setAvatarPending] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [personalDataModalVisible, setPersonalDataModalVisible] = useState(false);
  const { t } = useLocaleContext();

  useEffect(() => {
    getSessionToken().then((token) => {
      if (!token) return;
      setClaims(decodeSessionToken(token));
      fetchMyAvatar(token).then(setAvatar);
    });
  }, []);

  async function handlePickAvatar(source: "camera" | "library") {
    const token = await getSessionToken();
    if (!token) return;
    const uri = await pickPhoto(source);
    if (!uri) return;
    const dataUrl = await readPhotoAsDataUrl(uri);
    setAvatarPending(true);
    try {
      const ok = await updateMyAvatar(token, dataUrl);
      if (ok) setAvatar(dataUrl);
    } finally {
      setAvatarPending(false);
    }
  }

  async function handleRemoveAvatar() {
    const token = await getSessionToken();
    if (!token) return;
    setAvatarPending(true);
    try {
      const ok = await removeMyAvatar(token);
      if (ok) setAvatar(null);
    } finally {
      setAvatarPending(false);
    }
  }

  function closePasswordModal() {
    setPasswordModalVisible(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSuccess(false);
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword || passwordSubmitting) return;
    if (newPassword !== confirmPassword) {
      setPasswordError(t("As senhas não coincidem."));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("A nova senha precisa ter pelo menos 8 caracteres."));
      return;
    }
    const token = await getSessionToken();
    if (!token) return;
    setPasswordSubmitting(true);
    setPasswordError(null);
    try {
      const result = await submitChangePassword(token, currentPassword, newPassword);
      if (result.ok) {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordError(t(result.message));
      }
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function handleLogout() {
    const token = await getSessionToken();
    if (token) {
      try {
        await unregisterPushNotifications(token);
      } catch {
        // Best-effort — logout must never get stuck behind push-token
        // cleanup (e.g. expo-notifications throwing on Android in Expo Go).
      }
    }
    await clearSessionToken();
    resetNotifications();
    router.replace("/login");
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title={t("Perfil")} />
      <View style={styles.content}>
        <View style={[styles.identityCard, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: theme.background }]}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Ionicons name="person-outline" size={32} color={theme.secondary} />
              )}
            </View>
            <Pressable
              accessibilityLabel={t("Editar foto")}
              style={[styles.avatarEditBadge, { backgroundColor: theme.backgroundElement, borderColor: theme.background }]}
              onPress={() => setPhotoModalVisible(true)}
            >
              <Ionicons name="pencil" size={12} color={theme.text} />
            </Pressable>
          </View>
          <ThemedText type="subtitle" style={styles.name}>
            {claims?.name ?? t("Colaborador")}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {claims ? t(ROLE_SOURCE_LABEL[claims.role]) : "—"}
          </ThemedText>
        </View>

        <Modal
          visible={photoModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPhotoModalVisible(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setPhotoModalVisible(false)}>
            <Pressable
              style={[styles.modalCard, { backgroundColor: theme.backgroundElement }]}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={[styles.avatar, { backgroundColor: theme.background }]}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Ionicons name="person-outline" size={32} color={theme.secondary} />
                )}
              </View>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                {t("Editar foto")}
              </ThemedText>
              <View style={styles.avatarButtons}>
                <Pressable
                  style={[styles.avatarButton, { backgroundColor: theme.background, opacity: avatarPending ? 0.5 : 1 }]}
                  disabled={avatarPending}
                  onPress={() => handlePickAvatar("camera")}
                >
                  <Ionicons name="camera-outline" size={18} color={theme.secondary} />
                  <ThemedText type="small">{t("Tirar foto")}</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.avatarButton, { backgroundColor: theme.background, opacity: avatarPending ? 0.5 : 1 }]}
                  disabled={avatarPending}
                  onPress={() => handlePickAvatar("library")}
                >
                  <Ionicons name="image-outline" size={18} color={theme.secondary} />
                  <ThemedText type="small">{t("Galeria")}</ThemedText>
                </Pressable>
              </View>
              {avatar ? (
                <Pressable disabled={avatarPending} onPress={handleRemoveAvatar} style={styles.modalRemove}>
                  <ThemedText type="small" style={{ color: theme.accent }}>
                    {t("Remover foto")}
                  </ThemedText>
                </Pressable>
              ) : null}
              <Pressable style={styles.modalClose} onPress={() => setPhotoModalVisible(false)}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t("Fechar")}
                </ThemedText>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={passwordModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closePasswordModal}
        >
          <Pressable style={styles.modalBackdrop} onPress={closePasswordModal}>
            <Pressable
              style={[styles.modalCard, { backgroundColor: theme.backgroundElement }]}
              onPress={(event) => event.stopPropagation()}
            >
              <ThemedText type="subtitle" style={styles.modalTitle}>
                {t("Alterar senha")}
              </ThemedText>
              {passwordSuccess ? (
                <ThemedText type="small" style={{ color: theme.success }}>
                  {t("Senha alterada com sucesso.")}
                </ThemedText>
              ) : null}
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder={t("Senha atual")}
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                style={[styles.passwordInput, { backgroundColor: theme.background, color: theme.text }]}
              />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t("Nova senha")}
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                style={[styles.passwordInput, { backgroundColor: theme.background, color: theme.text }]}
              />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t("Confirmar nova senha")}
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                style={[styles.passwordInput, { backgroundColor: theme.background, color: theme.text }]}
              />
              {passwordError ? (
                <ThemedText type="small" style={{ color: theme.accent }}>
                  {passwordError}
                </ThemedText>
              ) : null}
              <ThemedButton
                title={passwordSubmitting ? t("Salvando...") : t("Salvar nova senha")}
                onPress={handleChangePassword}
              />
              <Pressable style={styles.modalClose} onPress={closePasswordModal}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t("Fechar")}
                </ThemedText>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <PersonalDataModal
          visible={personalDataModalVisible}
          onClose={() => setPersonalDataModalVisible(false)}
        />

        <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
          <MenuRow
            icon="person-outline"
            label={t("Meu Perfil")}
            onPress={() => setPersonalDataModalVisible(true)}
          />
          <MenuRow
            icon="key-outline"
            label={t("Alterar senha")}
            onPress={() => setPasswordModalVisible(true)}
          />
          <MenuRow
            icon="help-circle-outline"
            label={t("Central de Ajuda")}
            onPress={() => router.push("/ajuda")}
          />
          <MenuRow
            icon="rocket-outline"
            label={t("Boas-vindas / Onboarding")}
            onPress={() => router.push("/onboarding")}
          />
          <MenuRow
            icon="gift-outline"
            label={t("Benefícios e clube de vantagens")}
            onPress={() => router.push("/beneficios")}
          />
          <MenuRow
            icon="construct-outline"
            label={t("Operacional / TI")}
            onPress={() => router.push("/operacional")}
            last={claims?.role === "colaborador" || !claims}
          />
          {claims && claims.role !== "colaborador" ? (
            <MenuRow
              icon="people-outline"
              label={t("Atestados da equipe")}
              onPress={() => router.push("/atestados-equipe")}
              last
            />
          ) : null}
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
          <LanguageSwitcher />
        </View>

        <Pressable
          style={[styles.logoutButton, { backgroundColor: theme.backgroundElement }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.accent} />
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            {t("Sair da conta")}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuRow, !last && styles.menuRowDivider, !last && { borderColor: theme.background }]}
    >
      <Ionicons name={icon} size={18} color={theme.textSecondary} />
      <ThemedText type="small" style={styles.menuLabel}>
        {label}
      </ThemedText>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  identityCard: {
    alignItems: "center",
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  avatarWrap: {
    position: "relative",
    marginBottom: Spacing.two,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 64,
    height: 64,
  },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarButtons: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  avatarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    borderRadius: 10,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: "center",
    gap: Spacing.one,
  },
  modalTitle: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: Spacing.one,
  },
  modalRemove: {
    marginTop: Spacing.one,
  },
  modalClose: {
    marginTop: Spacing.two,
  },
  passwordInput: {
    alignSelf: "stretch",
    borderRadius: 8,
    fontSize: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  name: {
    fontSize: 18,
    lineHeight: 24,
  },
  section: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  menuRowDivider: {
    borderBottomWidth: 1,
  },
  menuLabel: {
    flex: 1,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderRadius: 14,
    paddingVertical: Spacing.three,
  },
});
