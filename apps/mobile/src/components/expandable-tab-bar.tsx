import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useRef, type ComponentProps } from "react";

import { ThemedText } from "@/components/themed-text";
import { useLocaleContext } from "@/context/locale-context";
import { useTheme } from "@/hooks/use-theme";
import { Radius, Spacing } from "@/constants/theme";
import { useNotificationContext } from "@/context/notification-context";

type TabBarRenderer = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;
type ExpandableTabBarProps = Parameters<TabBarRenderer>[0];

export function ExpandableTabBar({ state, descriptors, navigation }: ExpandableTabBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotificationContext();
  const { t } = useLocaleContext();
  const scrollViewRef = useRef<ScrollView>(null);

  return (
    <View
      style={[
        styles.mainRow,
        {
          backgroundColor: theme.backgroundElement,
          borderTopLeftRadius: Radius.xl,
          borderTopRightRadius: Radius.xl,
          paddingBottom: Spacing.one + insets.bottom,
        },
      ]}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = String(options.title ?? route.name);

          function onPress() {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              accessibilityLabel={`${label}, tab, ${index + 1} of ${state.routes.length}`}
            >
              {options.tabBarIcon?.({ focused, color: focused ? theme.secondary : theme.textSecondary, size: 24 })}
              <ThemedText type="small" style={[styles.tabLabel, focused ? { color: theme.secondary } : undefined]}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}

        <Pressable style={styles.tabItem} onPress={() => router.push("/onboarding")}>
          <Ionicons name="rocket-outline" size={24} color={theme.textSecondary} />
          <ThemedText type="small" style={styles.tabLabel}>
            {t("Onboarding")}
          </ThemedText>
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => router.push("/notificacoes")}>
          <View>
            <Ionicons name="notifications-outline" size={24} color={theme.textSecondary} />
            {unreadCount > 0 ? <View style={[styles.badge, { backgroundColor: theme.accent }]} /> : null}
          </View>
          <ThemedText type="small" style={styles.tabLabel}>
            {t("Notificações")}
          </ThemedText>
        </Pressable>
      </ScrollView>
      <Pressable
        onPress={() => scrollViewRef.current?.scrollTo({ x: 0, animated: true })}
        style={[styles.scrollHint, styles.scrollHintLeft, { backgroundColor: `${theme.backgroundElement}ee` }]}
        accessibilityLabel="Voltar aos primeiros itens"
        accessibilityRole="button"
      >
        <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
      </Pressable>
      <Pressable
        onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        style={[styles.scrollHint, { backgroundColor: `${theme.backgroundElement}ee` }]}
        accessibilityLabel="Ver mais itens"
        accessibilityRole="button"
      >
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  mainRow: {
    flexDirection: "row",
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  scrollContent: {
    alignItems: "flex-start",
    paddingLeft: 30,
    paddingRight: 30,
  },
  scrollHint: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollHintLeft: {
    left: 0,
    right: undefined,
  },
  tabItem: {
    width: 104,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: Spacing.one,
    gap: 2,
  },
  tabLabel: {
    textAlign: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
