import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { getFaqCategories, type FaqItem } from "@/constants/faq-content";
import { useLocaleContext } from "@/context/locale-context";
import { decodeSessionToken, type SessionClaims } from "@/lib/jwt";
import { getSessionToken } from "@/lib/session";

export default function AjudaScreen() {
  const [role, setRole] = useState<SessionClaims["role"] | null>(null);
  const { locale, t } = useLocaleContext();

  useEffect(() => {
    getSessionToken().then((token) => {
      if (!token) return;
      const claims = decodeSessionToken(token);
      if (claims) setRole(claims.role);
    });
  }, []);

  const categories = getFaqCategories(locale).filter(
    (category) => !category.roles || (role && category.roles.includes(role)),
  );

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title={t("Central de Ajuda")} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="small" themeColor="textSecondary">
          {t(
            "Dúvidas comuns sobre como usar o SGP. Se não encontrar o que procura aqui, fale com seu gestor ou com o RH.",
          )}
        </ThemedText>
        {categories.map((category) => (
          <View key={category.title} style={styles.category}>
            <ThemedText type="smallBold">{category.title}</ThemedText>
            {category.items.map((item) => (
              <FaqAccordionItem key={item.question} item={item} />
            ))}
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

function FaqAccordionItem({ item }: { item: FaqItem }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.item, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        style={styles.itemHeader}
        onPress={() => setOpen((current) => !current)}
        accessibilityRole="button"
      >
        <ThemedText type="small" style={styles.question}>
          {item.question}
        </ThemedText>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.textSecondary}
        />
      </Pressable>
      {open ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.answer}>
          {item.answer}
        </ThemedText>
      ) : null}
    </View>
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
  category: {
    gap: Spacing.two,
  },
  item: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  question: {
    flex: 1,
    fontWeight: "600",
  },
  answer: {
    paddingBottom: Spacing.three,
    lineHeight: 20,
  },
});
