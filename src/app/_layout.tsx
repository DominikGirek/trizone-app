import { bootSummary, mark, sinceBoot } from '@/lib/bootTiming'; // must be first: marks JS startup (BOOT_T0)
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
  useFonts,
} from '@expo-google-fonts/archivo';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplash } from '@/components/AnimatedSplash';
import { ToastProvider } from '@/components/Toast';
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
mark('layout-module-eval'); // all top-level imports of _layout (+ their module graph) have evaluated

let firstRenderMarked = false;

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
  if (!firstRenderMarked) {
    firstRenderMarked = true;
    mark('root-first-render');
  }
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
  const fontsMsRef = useRef<number | null>(null);
  const diagShownRef = useRef(false);

  // TEMP boot diagnostic: shows where the cold-start time goes (JS phase vs native phase) + whether the
  // app is running its embedded bundle or an OTA. Remove once the slow-start cause is confirmed.
  const showBootDiag = () => {
    if (diagShownRef.current) return;
    diagShownRef.current = true;
    const safe = (fn: () => unknown) => {
      try {
        return String(fn() ?? '—');
      } catch {
        return '—';
      }
    };
    Alert.alert(
      'Boot-Diagnose (bitte Screenshot)',
      `JS-Start → sichtbar: ${sinceBoot()} ms\n` +
        `Fonts: ${fontsMsRef.current ?? '?'} ms · Läuft: ${safe(() =>
          Updates.isEmbeddedLaunch ? 'EINGEBAUT' : 'OTA',
        )}\n` +
        `--- Phasen (ms ab JS-Start) ---\n` +
        bootSummary(),
      [{ text: 'OK' }],
    );
  };

  useEffect(() => {
    if (!fontsLoaded) return;
    if (fontsMsRef.current == null) fontsMsRef.current = sinceBoot();
    mark('effect-after-fonts');
    SplashScreen.hideAsync().catch(() => {});
    // EXPERIMENT: no data prefetch on the start path. Reveal after a fixed short beat and let the dashboard
    // load its own data (with skeletons). Isolates whether the prefetch/reveal machinery was the freeze.
    const reveal = setTimeout(() => {
      mark('reveal-called');
      setReady(true);
    }, 500);
    // Fire the diagnostic late, so it captures any freeze that happens AFTER the reveal (the block detector
    // records the gap regardless). If the thread is blocked, this timer itself fires late too.
    const diag = setTimeout(showBootDiag, 6000);
    return () => {
      clearTimeout(reveal);
      clearTimeout(diag);
    };
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
