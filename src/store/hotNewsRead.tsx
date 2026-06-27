import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storage, StorageKeys } from '@/lib/storage';

/**
 * Which hot-news alerts the user has acknowledged ("als gelesen") on the dashboard. Keyed by
 * `${raceId}:${category}` — so a dismissal only silences THAT state. If the situation escalates
 * to a new category (e.g. shortened → cancelled), the new key isn't read, so a fresh banner
 * surfaces. Local + persisted. The 6s undo lives in the banner (it only marks read after the
 * grace period), so this store just needs read/markRead.
 */
interface HotNewsReadValue {
  isRead: (key: string) => boolean;
  markRead: (key: string) => void;
}

const HotNewsReadContext = createContext<HotNewsReadValue | null>(null);

export function HotNewsReadProvider({ children }: { children: ReactNode }) {
  const [read, setRead] = useState<Record<string, number>>({});

  useEffect(() => {
    storage.get<Record<string, number>>(StorageKeys.hotNewsRead).then((v) => {
      if (v) setRead(v);
    });
  }, []);

  const value = useMemo<HotNewsReadValue>(
    () => ({
      isRead: (key) => key in read,
      markRead: (key) =>
        setRead((prev) => {
          if (key in prev) return prev;
          const next = { ...prev, [key]: Date.now() };
          storage.set(StorageKeys.hotNewsRead, next);
          return next;
        }),
    }),
    [read],
  );

  return <HotNewsReadContext.Provider value={value}>{children}</HotNewsReadContext.Provider>;
}

export function useHotNewsRead(): HotNewsReadValue {
  const ctx = useContext(HotNewsReadContext);
  if (!ctx) throw new Error('useHotNewsRead must be used within a HotNewsReadProvider');
  return ctx;
}
