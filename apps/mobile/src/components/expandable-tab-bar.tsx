import { useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import type { ComponentProps } from "react";

import { ThemedText } from "@/components/themed-text";
import { useLocaleContext } from "@/context/locale-context";
import { useTheme } from "@/hooks/use-theme";
import { Radius, Spacing } from "@/constants/theme";
import { useNotificationContext } from "@/context/notification-context";

// Derived structurally from <Tabs>'s own `tabBar` prop type instead of
// importing BottomTabBarProps from @react-navigation/bottom-tabs directly —
// that package is only a transitive dependency here (expo-router depends
// on it, apps/mobile does not declare it itself).
type TabBarRenderer = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;
type ExpandableTabBarProps = Parameters<TabBarRenderer>[0];

const EXTRA_ROW_HEIGHT = 64;

export function ExpandableTabBar({ state, descriptors, navigation }: ExpandableTabBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotificationContext();
  const { t } = useLocaleContext();
  const [expanded, setExpanded] = useState(false);
  const [heightAnim] = useState(() => new Animated.Value(0));

  // On open, `expanded` flips to true before the height animation starts
  // growing from 0, so there's nothing visible to pop in. On close, the
  // reverse ordering matters: unmounting the shortcut row's children
  // synchronously (before the height animation finishes) would make the
  // content vanish instantly while an empty box visibly shrinks over the
  // next 200ms. So close only flips `expanded` back to false once the
  // closing animation's completion callback fires, keeping content mounted
  // (and the RTL-query-visible fix from earlier) for the full close.
  function toggle() {
    if (expanded) {
      Animated.timing(heightAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start(() =>
        setExpanded(false),
      );
    } else {
      setExpanded(true);
      Animated.timing(heightAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    }
  }

  function goToShortcut(path: "/onboarding" | "/notificacoes") {
    Animated.timing(heightAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start(() =>
      setExpanded(false),
    );
    router.push(path);
  }

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.extraRow,
          {
            backgroundColor: theme.backgroundElement,
            height: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, EXTRA_ROW_HEIGHT] }),
          },
        ]}
      >
        {/* Gated on `expanded` (not just the animated height) so the shortcuts
            are genuinely absent from the tree while collapsed — an
            overflow:hidden height:0 wrapper still keeps its children mounted
            and reachable by accessibility/text queries otherwise. */}
        {expanded ? (
          <>
            <Pressable style={styles.extraItem} onPress={() => goToShortcut("/onboarding")}>
              <Ionicons name="rocket-outline" size={22} color={theme.textSecondary} />
              <ThemedText type="small">{t("Onboarding")}</ThemedText>
            </Pressable>
            <Pressable style={styles.extraItem} onPress={() => goToShortcut("/notificacoes")}>
              <View>
                <Ionicons name="notifications-outline" size={22} color={theme.textSecondary} />
                {unreadCount > 0 ? <View style={[styles.badge, { backgroundColor: theme.accent }]} /> : null}
              </View>
              <ThemedText type="small">{t("Notificações")}</ThemedText>
            </Pressable>
          </>
        ) : null}
      </Animated.View>

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
        <Pressable style={styles.expandHandle} onPress={toggle} accessibilityLabel={t("Mais opções")}>
          <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={16} color={theme.textSecondary} />
        </Pressable>

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "column",
  },
  extraRow: {
    flexDirection: "row",
    overflow: "hidden",
  },
  extraItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
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
  expandHandle: {
    position: "absolute",
    top: -14,
    left: "50%",
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: Spacing.one,
    gap: 2,
  },
  tabLabel: {
    textAlign: "center",
  },
});
