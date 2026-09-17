import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { AdmissionDocumentBox } from "@/components/admission-document-box";
import { ContractBox } from "@/components/contract-box";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Elevation, Spacing } from "@/constants/theme";
import {
  formatBRL,
  netPay,
  type DocumentStatus,
} from "@/lib/documentos";
import { exportHoleritePdf } from "@/lib/export-holerite";
import { pickPhoto } from "@/lib/photo-picker";
import { readPhotoAsDataUrl } from "@/lib/photo-data-url";
import { extractAtestadoData } from "@/lib/atestado-ocr";
import { fetchMyAtestados, submitAtestado, type AtestadoRecord } from "@/lib/atestados-api";
import {
  ADMISSION_DOCUMENT_KIND_LABELS,
  ADMISSION_DOCUMENT_KINDS,
  fetchAdmissionDocuments,
  fetchCertifications,
  fetchPayslips,
  submitCertification,
  fetchSignedContract,
  type AdmissionDocumentRecord,
  type CertificationRecord,
  type PayslipRecord,
  type SignedContractRecord,
} from "@/lib/documentos-api";
import { getSessionToken } from "@/lib/session";

type Category = "admissionais" | "atestados" | "holerites" | "certificacoes" | "contrato";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "admissionais", label: "Admissionais" },
  { key: "atestados", label: "Atestados" },
  { key: "holerites", label: "Holerites" },
  { key: "certificacoes", label: "Certificações" },
  { key: "contrato", label: "Contrato" },
];

export default function DocumentosScreen() {
  const theme = useTheme();
  const [category, setCategory] = useState<Category>("atestados");

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.pageTitle}>
          Documentos
        </ThemedText>

        <View style={styles.categoryFilter}>
          {CATEGORIES.map((option) => {
            const active = option.key === category;
            return (
              <Pressable
                key={option.key}
                onPress={() => setCategory(option.key)}
                style={[
                  styles.categoryOption,
                  { backgroundColor: active ? theme.secondary : theme.backgroundElement },
                ]}
              >
                <ThemedText type="small" style={active ? { color: theme.onAccent } : undefined}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {category === "admissionais" ? <AdmissionaisSection /> : null}
        {category === "atestados" ? <AtestadosSection /> : null}
        {category === "holerites" ? <HoleritesSection /> : null}
        {category === "certificacoes" ? <CertificacoesSection /> : null}
        {category === "contrato" ? <ContratoSection /> : null}
      </ScrollView>
    </View>
  );
}

function AdmissionaisSection() {
  const [admissionDocuments, setAdmissionDocuments] = useState<AdmissionDocumentRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const result = await fetchAdmissionDocuments(token);
        if (!cancelled && result) setAdmissionDocuments(result);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const byKind = new Map(
    admissionDocuments.filter((doc) => doc.kind).map((doc) => [doc.kind as string, doc]),
  );

  return (
    <View style={styles.list}>
      {ADMISSION_DOCUMENT_KINDS.map((kind) => (
        <AdmissionDocumentBox
          key={kind}
          kind={kind}
          label={ADMISSION_DOCUMENT_KIND_LABELS[kind]}
          existing={byKind.get(kind) ?? null}
          onSubmitted={(created) =>
            setAdmissionDocuments((current) => [created, ...current.filter((d) => d.kind !== kind)])
          }
        />
      ))}
    </View>
  );
}

type OcrStatus = "idle" | "loading" | "done" | "error";

function AtestadosSection() {
  const theme = useTheme();
  const [atestados, setAtestados] = useState<AtestadoRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cid, setCid] = useState("");
  const [crm, setCrm] = useState("");
  const [medico, setMedico] = useState("");
  const [dias, setDias] = useState("");
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const result = await fetchMyAtestados(token);
        if (!cancelled && result) setAtestados(result);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handlePickPhoto(source: "camera" | "library") {
    const uri = await pickPhoto(source);
    if (!uri) return;
    setPhotoUri(uri);
    setOcrStatus("loading");

    const token = await getSessionToken();
    if (!token) {
      setOcrStatus("error");
      return;
    }
    const outcome = await extractAtestadoData(token, uri);
    if (!outcome.ok) {
      setOcrStatus("error");
      return;
    }
    const { result } = outcome;
    if (result.cid) setCid(result.cid);
    if (result.crm) setCrm(result.crm);
    if (result.medico) setMedico(result.medico);
    if (result.dias) setDias(String(result.dias));
    setOcrStatus("done");
  }

  function resetForm() {
    setPhotoUri(null);
    setCid("");
    setCrm("");
    setMedico("");
    setDias("");
    setOcrStatus("idle");
    setFormOpen(false);
  }

  async function handleSubmit() {
    const parsedDias = parseInt(dias, 10);
    if (!cid.trim() || !crm.trim() || !medico.trim() || !parsedDias) return;
    if (!photoUri) {
      Alert.alert("Foto obrigatória", "Tire uma foto ou escolha uma da galeria antes de enviar.");
      return;
    }
    const token = await getSessionToken();
    if (!token) return;
    const photoDataUrl = await readPhotoAsDataUrl(photoUri);
    const created = await submitAtestado(token, {
      cid: cid.trim(),
      crm: crm.trim(),
      medico: medico.trim(),
      dias: parsedDias,
      photoDataUrl,
    });
    if (created) {
      setAtestados((current) => [created, ...current]);
      resetForm();
    }
  }

  return (
    <View style={styles.list}>
      <ThemedButton
        title={formOpen ? "Cancelar" : "Enviar Atestado"}
        onPress={() => (formOpen ? resetForm() : setFormOpen(true))}
      />

      {formOpen ? (
        <View style={[styles.form, { backgroundColor: theme.backgroundElement }, Elevation.card]}>
          <ThemedText type="small" themeColor="textSecondary">
            Foto do atestado (obrigatória)
          </ThemedText>
          <View style={styles.photoButtons}>
            <Pressable
              style={[styles.photoButton, { backgroundColor: theme.background }]}
              onPress={() => handlePickPhoto("camera")}
            >
              <Ionicons name="camera-outline" size={20} color={theme.secondary} />
              <ThemedText type="small">Tirar foto</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.photoButton, { backgroundColor: theme.background }]}
              onPress={() => handlePickPhoto("library")}
            >
              <Ionicons name="image-outline" size={20} color={theme.secondary} />
              <ThemedText type="small">Escolher da galeria</ThemedText>
            </Pressable>
          </View>

          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.preview} contentFit="cover" />
          ) : null}

          {ocrStatus !== "idle" ? (
            <ThemedText type="small" themeColor="textSecondary">
              {ocrStatus === "loading"
                ? "Lendo o atestado automaticamente…"
                : ocrStatus === "done"
                  ? "Dados preenchidos automaticamente — confira antes de enviar."
                  : "Não foi possível ler automaticamente — preencha os dados abaixo manualmente."}
            </ThemedText>
          ) : null}

          <TextInput
            value={cid}
            onChangeText={setCid}
            placeholder="CID"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          />
          <TextInput
            value={crm}
            onChangeText={setCrm}
            placeholder="CRM do médico"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          />
          <TextInput
            value={medico}
            onChangeText={setMedico}
            placeholder="Nome do médico"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          />
          <TextInput
            value={dias}
            onChangeText={setDias}
            placeholder="Quantidade de dias"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          />

          <ThemedButton title="Enviar" onPress={handleSubmit} />
        </View>
      ) : null}

      {atestados.length === 0 ? (
        <EmptyState
          glyph="🩺"
          title="Nenhum atestado enviado"
          description="Atestados enviados aparecem aqui com o status da análise do RH."
        />
      ) : (
        atestados.map((atestado) => (
          <View
            key={atestado.id}
            style={[styles.row, { backgroundColor: theme.backgroundElement }, Elevation.card]}
          >
            <Ionicons name="medkit-outline" size={20} color={theme.secondary} />
            <View style={styles.rowContent}>
              <ThemedText type="smallBold">
                {atestado.dias} dia(s) · {atestado.crm}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {new Date(atestado.createdAt).toLocaleDateString("pt-BR")}
              </ThemedText>
            </View>
            <StatusBadge status={atestado.status as DocumentStatus} />
          </View>
        ))
      )}
    </View>
  );
}

function HoleritesSection() {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [exportingId, setExportingId] = useState<string | null>(null);

  async function handleDownload(payslip: PayslipRecord) {
    setExportingId(payslip.id);
    try {
      await exportHoleritePdf(payslip);
    } catch {
      Alert.alert("Não foi possível gerar o PDF", "Tente novamente em instantes.");
    } finally {
      setExportingId(null);
    }
  }

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const result = await fetchPayslips(token);
        if (!cancelled && result) setPayslips(result);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View style={styles.list}>
      {payslips.map((payslip) => {
        const isOpen = expanded === payslip.id;
        return (
          <Pressable
            key={payslip.id}
            style={[styles.payslipCard, { backgroundColor: theme.backgroundElement }, Elevation.card]}
            onPress={() => setExpanded(isOpen ? null : payslip.id)}
          >
            <View style={styles.payslipHeader}>
              <ThemedText type="smallBold">{payslip.label}</ThemedText>
              <View style={styles.payslipHeaderRight}>
                <ThemedText type="smallBold">{formatBRL(netPay(payslip))}</ThemedText>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={theme.textSecondary}
                />
              </View>
            </View>
            {isOpen ? (
              <View style={[styles.payslipDetails, { backgroundColor: theme.background }]}>
                <PayslipLine label="Salário bruto" value={formatBRL(payslip.gross)} />
                <PayslipLine
                  label="INSS"
                  value={`- ${formatBRL(payslip.inss)}`}
                  hint="Contribuição para a Previdência Social, garante aposentadoria e benefícios."
                />
                <PayslipLine
                  label="IRRF"
                  value={`- ${formatBRL(payslip.irrf)}`}
                  hint="Imposto de Renda retido na fonte, calculado sobre o salário."
                />
                <PayslipLine
                  label="Benefícios"
                  value={`- ${formatBRL(payslip.benefits)}`}
                  hint="Vale-refeição, vale-transporte e plano de saúde já descontados."
                />
                <View style={styles.payslipDivider} />
                <PayslipLine label="Líquido a receber" value={formatBRL(netPay(payslip))} bold />
                <Pressable
                  onPress={() => handleDownload(payslip)}
                  disabled={exportingId === payslip.id}
                  style={styles.downloadRow}
                >
                  <Ionicons name="download-outline" size={16} color={theme.secondary} />
                  <ThemedText type="small" themeColor="secondary">
                    {exportingId === payslip.id ? "Gerando PDF..." : "Baixar PDF"}
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function PayslipLine({
  label,
  value,
  hint,
  bold,
}: {
  label: string;
  value: string;
  hint?: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.payslipLine}>
      <View style={styles.payslipLineRow}>
        <ThemedText type={bold ? "smallBold" : "small"} themeColor={bold ? undefined : "textSecondary"}>
          {label}
        </ThemedText>
        <ThemedText type={bold ? "smallBold" : "small"}>{value}</ThemedText>
      </View>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.payslipHint}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

function CertificacoesSection() {
  const theme = useTheme();
  const [certifications, setCertifications] = useState<CertificationRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [validUntil, setValidUntil] = useState("");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const result = await fetchCertifications(token);
        if (!cancelled && result) setCertifications(result);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleSubmit() {
    if (!name.trim() || !institution.trim() || !validUntil.trim()) return;
    const token = await getSessionToken();
    if (!token) return;
    const created = await submitCertification(token, {
      name: name.trim(),
      institution: institution.trim(),
      validUntil: validUntil.trim(),
    });
    if (created) {
      setCertifications((current) => [created, ...current]);
      setName("");
      setInstitution("");
      setValidUntil("");
      setFormOpen(false);
    }
  }

  return (
    <View style={styles.list}>
      <ThemedButton
        title={formOpen ? "Cancelar" : "Adicionar certificação"}
        onPress={() => setFormOpen((open) => !open)}
      />

      {formOpen ? (
        <View style={[styles.form, { backgroundColor: theme.backgroundElement }, Elevation.card]}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nome da certificação"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          />
          <TextInput
            value={institution}
            onChangeText={setInstitution}
            placeholder="Instituição"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          />
          <TextInput
            value={validUntil}
            onChangeText={setValidUntil}
            placeholder="Validade (DD/MM/AAAA)"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          />
          <ThemedButton title="Salvar" onPress={handleSubmit} />
        </View>
      ) : null}

      {certifications.length === 0 ? (
        <EmptyState
          glyph="🎓"
          title="Nenhuma certificação cadastrada"
          description="Adicione suas certificações para manter seu perfil técnico atualizado."
        />
      ) : (
        certifications.map((cert) => (
            <View key={cert.id} style={[styles.row, { backgroundColor: theme.backgroundElement }, Elevation.card]}>
              <Ionicons name="ribbon-outline" size={20} color={theme.secondary} />
              <View style={styles.rowContent}>
                <ThemedText type="smallBold">{cert.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {cert.institution} · válida até{" "}
                  {new Date(cert.validUntil).toLocaleDateString("pt-BR", {
                    timeZone: "UTC",
                  })}
                </ThemedText>
              </View>
            </View>
          ))
      )}
    </View>
  );
}

function ContratoSection() {
  const [contract, setContract] = useState<SignedContractRecord>({ submittedAt: null });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const result = await fetchSignedContract(token);
        if (!cancelled && result) setContract(result);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return <ContractBox existing={contract} onSubmitted={setContract} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  pageTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  categoryFilter: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  categoryOption: {
    borderRadius: 10,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  list: {
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
  form: {
    borderRadius: 14,
    padding: Spacing.three,
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
  preview: {
    width: "100%",
    height: 160,
    borderRadius: 12,
  },
  input: {
    borderRadius: 12,
    padding: Spacing.three,
    fontSize: 16,
  },
  payslipCard: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  payslipHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  payslipHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  payslipDetails: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  payslipLine: {
    gap: 2,
  },
  payslipLineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  payslipHint: {
    fontSize: 12,
  },
  payslipDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: Spacing.one,
  },
  downloadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
});
