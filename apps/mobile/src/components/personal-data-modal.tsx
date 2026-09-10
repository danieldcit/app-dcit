import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PickerField } from "./picker-field";
import { ThemedButton } from "./themed-button";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";
import { useLocaleContext } from "@/context/locale-context";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { getSessionToken } from "@/lib/session";
import {
  fetchMyPersonalData,
  updateMyPersonalData,
  type MyPersonalData,
} from "@/lib/personal-data-api";

const ESTADOS_CIVIS = ["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"] as const;
const ESTADO_CIVIL_SOURCE_OPTIONS = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União estável" },
] satisfies { value: (typeof ESTADOS_CIVIS)[number]; label: string }[];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;
const UF_OPTIONS = UFS.map((uf) => ({ value: uf, label: uf }));

const EMPTY: MyPersonalData = {
  rg: null,
  dataNascimento: null,
  estadoCivil: null,
  enderecoRua: null,
  enderecoNumero: null,
  enderecoBairro: null,
  enderecoCidade: null,
  enderecoEstado: null,
  enderecoCep: null,
  phone: null,
};

// "1995-03-10" -> "10/03/1995". No date-picker library is installed in this
// project (see design notes) — dates are a plain DD/MM/AAAA text field,
// converted to/from the API's ISO wire format here at the edges.
function isoToBr(iso: string | null): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function brToIso(br: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export function PersonalDataModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { t } = useLocaleContext();
  const [data, setData] = useState<MyPersonalData>(EMPTY);
  const [dataNascimentoBr, setDataNascimentoBr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const ESTADO_CIVIL_OPTIONS = ESTADO_CIVIL_SOURCE_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.label),
  }));

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSuccess(false);
    getSessionToken().then((token) => {
      if (!token) return;
      fetchMyPersonalData(token).then((result) => {
        if (!result) return;
        setData(result);
        setDataNascimentoBr(isoToBr(result.dataNascimento));
      });
    });
  }, [visible]);

  function setField<K extends keyof MyPersonalData>(field: K, value: string) {
    setData((current) => ({ ...current, [field]: value === "" ? null : value }));
  }

  async function handleCepBlur() {
    const digits = (data.enderecoCep ?? "").replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!response.ok) return;
      const cep = (await response.json()) as ViaCepResponse;
      if (cep.erro) return;
      setData((current) => ({
        ...current,
        enderecoRua: cep.logradouro || current.enderecoRua,
        enderecoBairro: cep.bairro || current.enderecoBairro,
        enderecoCidade: cep.localidade || current.enderecoCidade,
        enderecoEstado: cep.uf || current.enderecoEstado,
      }));
    } catch {
      // Network failure: leave the address fields exactly as they are.
    }
  }

  async function handleSave() {
    if (saving) return;
    let dataNascimento: string | null = null;
    if (dataNascimentoBr.trim()) {
      dataNascimento = brToIso(dataNascimentoBr);
      if (!dataNascimento) {
        setError(t("Data de nascimento inválida. Use o formato DD/MM/AAAA."));
        return;
      }
    }
    const token = await getSessionToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateMyPersonalData(token, { ...data, dataNascimento });
      if (result.ok) {
        setSuccess(true);
      } else {
        setError(t(result.message));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="subtitle">{t("Meu Perfil")}</ThemedText>
          <Pressable
            accessibilityLabel={t("Fechar")}
            style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}
            onPress={onClose}
          >
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {success ? (
            <ThemedText type="small" style={{ color: theme.success }}>
              {t("Dados salvos com sucesso.")}
            </ThemedText>
          ) : null}
          {error ? (
            <ThemedText type="small" style={{ color: theme.accent }}>
              {error}
            </ThemedText>
          ) : null}

          <Field label={t("RG")} value={data.rg} onChangeText={(v) => setField("rg", v)} />
          <View>
            <ThemedText type="small" themeColor="textSecondary">
              {t("Data de nascimento")}
            </ThemedText>
            <TextInput
              value={dataNascimentoBr}
              onChangeText={setDataNascimentoBr}
              placeholder="DD/MM/AAAA"
              accessibilityLabel={t("Data de nascimento")}
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={10}
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
            />
          </View>
          <PickerField
            label={t("Estado civil")}
            value={data.estadoCivil}
            options={ESTADO_CIVIL_OPTIONS}
            onChange={(v) => setData((current) => ({ ...current, estadoCivil: v }))}
          />
          <Field label={t("Telefone")} value={data.phone} onChangeText={(v) => setField("phone", v)} />
          <Field
            label={t("CEP")}
            value={data.enderecoCep}
            onChangeText={(v) => setField("enderecoCep", v)}
            onBlur={handleCepBlur}
          />
          <Field
            label={t("Rua")}
            value={data.enderecoRua}
            onChangeText={(v) => setField("enderecoRua", v)}
          />
          <Field
            label={t("Número")}
            value={data.enderecoNumero}
            onChangeText={(v) => setField("enderecoNumero", v)}
          />
          <Field
            label={t("Bairro")}
            value={data.enderecoBairro}
            onChangeText={(v) => setField("enderecoBairro", v)}
          />
          <Field
            label={t("Cidade")}
            value={data.enderecoCidade}
            onChangeText={(v) => setField("enderecoCidade", v)}
          />
          <PickerField
            label={t("Estado (UF)")}
            value={data.enderecoEstado}
            options={UF_OPTIONS}
            onChange={(v) => setData((current) => ({ ...current, enderecoEstado: v }))}
          />

          <ThemedButton title={saving ? t("Salvando...") : t("Salvar")} onPress={handleSave} />
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  onBlur,
}: {
  label: string;
  value: string | null;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
}) {
  const theme = useTheme();
  return (
    <View>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        value={value ?? ""}
        onChangeText={onChangeText}
        onBlur={onBlur}
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.four,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  input: {
    borderRadius: 8,
    fontSize: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginTop: 4,
  },
});
