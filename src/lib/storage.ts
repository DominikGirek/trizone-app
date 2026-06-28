import AsyncStorage from '@react-native-async-storage/async-storage';

/** Thin typed wrapper around AsyncStorage with JSON (de)serialization. */
export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore write failures (e.g. storage full / unavailable)
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const StorageKeys = {
  language: 'trizone.language',
  theme: 'trizone.theme',
  favorites: 'trizone.favorites',
  bookmarks: 'trizone.bookmarks',
  onboarded: 'trizone.onboarded',
  reminders: 'trizone.reminders',
  myRaces: 'trizone.myRaces',
  codeVotes: 'trizone.codeVotes',
  newsVotes: 'trizone.newsVotes',
  hotNewsRead: 'trizone.hotNewsRead',
  tips: 'trizone.tips',
  accountHint: 'trizone.accountHint',
} as const;
