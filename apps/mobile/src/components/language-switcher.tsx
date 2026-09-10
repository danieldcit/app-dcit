import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useLocaleContext } from "@/context/locale-context";
import { useTheme } from "@/hooks/use-theme";
import { LOCALES, LOCALE_LABELS } from "@/lib/locale";
import { Spacing } from "@/constants/theme";

export function LanguageSwitcher() {
  const theme = useTheme();
  const { locale, setLocale, t } = useLocaleContext();

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {t("Idioma")}
      </ThemedText>
      <View style={styles.options}>
        {LOCALES.map((value) => {
          const active = value === locale;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setLocale(value)}
              style={[
                styles.option,
                {
                  borderColor: active ? theme.text : theme.background,
                  backgroundColor: active ? theme.text : "transparent",
                },
              ]}
            >
              <ThemedText type="small" style={active ? { color: theme.background } : undefined}>
                {LOCALE_LABELS[value]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  label: {
    fontWeight: "600",
  },
  options: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  option: {
    flex: 1,
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: Spacing.two,
  },
});
