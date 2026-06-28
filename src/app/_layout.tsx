import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
  useFonts,
} from '@expo-google-fonts/archivo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplash } from '@/components/AnimatedSplash';
import { ToastProvider } from '@/components/Toast';
import { getAllEvents } from '@/services/events';
import { fetchNews } from '@/services/news';
import { Colors } from '@/constants/theme';
import '@/i18n';
import { AuthProvider } from '@/store/auth';
import { BookmarksProvider } from '@/store/bookmarks';
import { CodeVotesProvider } from '@/store/codeVotes';
import { PushSync } from '@/components/PushSync';
import { HotNewsReadProvider } from '@/store/hotNewsRead';
import { NewsVotesProvider } from '@/store/newsVotes';
import { FavoritesProvider } from '@/store/favorites';
import { MyRacesProvider } from '@/store/myRaces';
import { RemindersProvider } from '@/store/reminders';
import { TipsProvider } from '@/store/tips';
import { SettingsProvider, useResolvedScheme } from '@/store/settings';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

SplashScreen.preventAutoHideAsync().catch(() => {});

function NavigationStack() {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.background, card: colors.background },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="news" options={{ title: '', headerBackTitle: '' }} />
        <Stack.Screen name="search" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="pick-race" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="report" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="following" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="my-races" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="login" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="handle" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="group/new" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="group/[id]" options={{ title: '', headerBackTitle: '' }} />
        <Stack.Screen name="tip/[id]" options={{ title: '', headerBackTitle: '' }} />
        <Stack.Screen name="race/[id]" options={{ title: '', headerBackTitle: '' }} />
        <Stack.Screen name="event/[id]" options={{ title: '', headerBackTitle: '' }} />
        <Stack.Screen name="local/[id]" options={{ title: '', headerBackTitle: '' }} />
        <Stack.Screen name="live/[eventId]" options={{ title: '', headerBackTitle: '' }} />
        <Stack.Screen name="league/[guid]" options={{ title: '', headerBackTitle: '' }} />
        <Stack.Screen name="athlete/[id]" options={{ title: '', headerBackTitle: '' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Archivo_900Black,
  });

  const [ready, setReady] = useState(false);
  const [splashGone, setSplashGone] = useState(false);

  useEffect(() => {
    if (!fontsLoaded) return;
    SplashScreen.hideAsync().catch(() => {}); // native splash off — the animated curtain takes over seamlessly
    let revealed = false;
    const since = Date.now();
    const doReveal = () => {
      if (!revealed) {
        revealed = true;
        setReady(true);
      }
    };
    // Warm the first screen's data so the revealed app is ready (no tapping into a still-building UI),
    // with a small minimum (so the curtain feels intentional) and a hard cap (so it never hangs).
    Promise.allSettled([
      queryClient.prefetchQuery({ queryKey: ['events'], queryFn: () => getAllEvents() }),
      queryClient.prefetchQuery({ queryKey: ['news'], queryFn: fetchNews }),
    ]).finally(() => setTimeout(doReveal, Math.max(0, 600 - (Date.now() - since))));
    const cap = setTimeout(doReveal, 2800);
    return () => clearTimeout(cap);
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SettingsProvider>
            <FavoritesProvider>
              <BookmarksProvider>
                <RemindersProvider>
                  <MyRacesProvider>
                    <CodeVotesProvider>
                      <NewsVotesProvider>
                        <HotNewsReadProvider>
                          <TipsProvider>
                            <ToastProvider>
                              <PushSync />
                              <NavigationStack />
                            </ToastProvider>
                          </TipsProvider>
                        </HotNewsReadProvider>
                      </NewsVotesProvider>
                    </CodeVotesProvider>
                  </MyRacesProvider>
                </RemindersProvider>
              </BookmarksProvider>
            </FavoritesProvider>
          </SettingsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
      {!splashGone && <AnimatedSplash reveal={ready} onDone={() => setSplashGone(true)} />}
    </GestureHandlerRootView>
  );
}
