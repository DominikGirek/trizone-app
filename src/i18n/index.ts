import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';

export const resources = {
  de: { translation: de },
  en: { translation: en },
} as const;

export type AppLanguage = keyof typeof resources;
export const SUPPORTED_LANGUAGES: AppLanguage[] = ['de', 'en'];

/** Best supported language for the current device, defaulting to English. */
export function getDeviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  return code && (SUPPORTED_LANGUAGES as string[]).includes(code)
    ? (code as AppLanguage)
    : 'en';
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export default i18n;
