import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';

import { PontoProvider } from '@/context/ponto-context';
import { NotificationProvider, useNotificationContext } from '@/context/notification-context';
import { AppLocaleProvider } from '@/context/locale-context';
import { AppThemeProvider, useThemeContext } from '@/context/theme-context';
import { configureNotificationHandler, addNotificationTapListener } from '@/lib/push';

// Keeps login as the base of the stack for a cold, unauthenticated start;
// login itself checks for a saved session on focus and redirects to
// (tabs) when one exists (see login.tsx's useFocusEffect).
export const unstable_settings = {
  initialRouteName: 'login',
};

function NotificationTapHandler() {
  const { refresh, handlePress } = useNotificationContext();
  const router = useRouter();

  useEffect(() => {
    configureNotificationHandler();
    return addNotificationTapListener(async (data) => {
      const payload = data as { notificationId?: string; link?: string | null };
      if (!payload.notificationId) return;
      const fetched = await refresh();
      const found = fetched.find((n) => n.id === payload.notificationId);
      if (found) {
        handlePress(found);
      } else if (payload.link) {
        router.push(payload.link as Href);
      }
    });
  }, [refresh, handlePress, router]);

  return null;
}

function NavigationThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useThemeContext();
  return <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>{children}</ThemeProvider>;
}

export default function RootLayout() {
  return (
    <AppLocaleProvider>
      <AppThemeProvider>
        <NavigationThemeProvider>
          <PontoProvider>
            <NotificationProvider>
              <NotificationTapHandler />
              <Stack screenOptions={{ headerShown: false }} />
            </NotificationProvider>
          </PontoProvider>
        </NavigationThemeProvider>
      </AppThemeProvider>
    </AppLocaleProvider>
  );
}
