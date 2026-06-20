import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import i18n, { AppLanguage, getDeviceLanguage } from '@/i18n';
import { storage, StorageKeys } from '@/lib/storage';

export type ThemePref = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

interface SettingsValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  themePref: ThemePref;
  setThemePref: (pref: ThemePref) => void;
  resolvedScheme: ResolvedScheme;
  onboarded: boolean;
  completeOnboarding: () => void;
  ready: boolean;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [language, setLanguageState] = useState<AppLanguage>(getDeviceLanguage());
  const [themePref, setThemePrefState] = useState<ThemePref>('system');
  const [onboarded, setOnboarded] = useState(false);
  const [ready, setReady] = useState(false);

  // Load persisted preferences on first mount.
  useEffect(() => {
    (async () => {
      const [savedLang, savedTheme, savedOnboarded] = await Promise.all([
        storage.get<AppLanguage>(StorageKeys.language),
        storage.get<ThemePref>(StorageKeys.theme),
        storage.get<boolean>(StorageKeys.onboarded),
      ]);
      if (savedLang) {
        setLanguageState(savedLang);
        if (i18n.language !== savedLang) i18n.changeLanguage(savedLang);
      }
      if (savedTheme) setThemePrefState(savedTheme);
      if (savedOnboarded) setOnboarded(true);
      setReady(true);
    })();
  }, []);

  const completeOnboarding = () => {
    setOnboarded(true);
    storage.set(StorageKeys.onboarded, true);
  };

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    storage.set(StorageKeys.language, lang);
  };

  const setThemePref = (pref: ThemePref) => {
    setThemePrefState(pref);
    storage.set(StorageKeys.theme, pref);
  };

  const resolvedScheme: ResolvedScheme =
    themePref === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themePref;

  const value = useMemo<SettingsValue>(
    () => ({
      language,
      setLanguage,
      themePref,
      setThemePref,
      resolvedScheme,
      onboarded,
      completeOnboarding,
      ready,
    }),
    [language, themePref, resolvedScheme, onboarded, ready],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}

/** Resolved color scheme, safe to call outside the provider (falls back to light). */
export function useResolvedScheme(): ResolvedScheme {
  const ctx = useContext(SettingsContext);
  return ctx?.resolvedScheme ?? 'light';
}
