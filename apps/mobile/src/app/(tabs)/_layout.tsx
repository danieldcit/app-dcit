import { Tabs, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallback } from "react";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { ExpandableTabBar } from "@/components/expandable-tab-bar";
import { useTheme } from "@/hooks/use-theme";
import { Radius } from "@/constants/theme";
import { decodeSessionToken } from "@/lib/jwt";
import { fetchOnboardingStatus } from "@/lib/onboarding-api";
import { getSessionToken } from "@/lib/session";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(outline: IconName, filled: IconName) {
  function TabIcon({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) {
    return <Ionicons name={focused ? filled : outline} size={size} color={color} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const theme = useTheme();
  const router = useRouter();

  // Expo Router has no server middleware — from the root Stack's
  // perspective (tabs) is a single screen, so this fires every time the
  // group gains focus (including returning from /onboarding), same trigger
  // point the web version's middleware+layout combination covers per
  // request. Fail-open on any error/missing response, same as the web gate.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const token = await getSessionToken();
        if (!token || cancelled) return;
        const claims = decodeSessionToken(token);
        if (claims?.role !== "colaborador") return;
        const status = await fetchOnboardingStatus(token);
        // Only a confirmed { unlocked: false } locks the door — an ambiguous
        // or malformed response (missing field, non-boolean, etc.) fails
        // open just like a network error does, same as the web gate.
        if (cancelled || !status || status.unlocked !== false) return;
        router.replace("/onboarding");
      })();
      return () => {
        cancelled = true;
      };
    }, [router]),
  );

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <ExpandableTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{ title: "Ponto", tabBarIcon: tabIcon("time-outline", "time") }}
      />
      <Tabs.Screen
        name="banco-de-horas"
        options={{
          title: "Banco de Horas",
          tabBarIcon: tabIcon("hourglass-outline", "hourglass"),
        }}
      />
      <Tabs.Screen
        name="ferias"
        options={{ title: "Férias", tabBarIcon: tabIcon("sunny-outline", "sunny") }}
      />
      <Tabs.Screen
        name="documentos"
        options={{
          title: "Documentos",
          tabBarIcon: tabIcon("document-text-outline", "document-text"),
        }}
      />
      <Tabs.Screen
        name="mural"
        options={{ title: "Mural", tabBarIcon: tabIcon("megaphone-outline", "megaphone") }}
      />
    </Tabs>
  );
}
