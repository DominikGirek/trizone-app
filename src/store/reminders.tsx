import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  cancelReminder,
  ensureNotificationPermission,
  scheduleRaceReminder,
} from '@/lib/notifications';
import { storage, StorageKeys } from '@/lib/storage';

export type ToggleResult = 'on' | 'off' | 'denied';

/** Anything with an id and a start date can have a reminder (Race or LocalEvent). */
export interface Remindable {
  id: string;
  date: string;
}

interface RemindersValue {
  hasReminder: (id: string) => boolean;
  /** Schedules or cancels a local reminder for the event. */
  toggle: (event: Remindable, title: string, body: string) => Promise<ToggleResult>;
}

const RemindersContext = createContext<RemindersValue | null>(null);

export function RemindersProvider({ children }: { children: ReactNode }) {
  // raceId -> scheduled notification id
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    storage.get<Record<string, string>>(StorageKeys.reminders).then((m) => {
      if (m) setMap(m);
    });
  }, []);

  const persist = (next: Record<string, string>) => {
    setMap(next);
    storage.set(StorageKeys.reminders, next);
  };

  const hasReminder = (id: string) => id in map;

  const toggle = async (event: Remindable, title: string, body: string): Promise<ToggleResult> => {
    if (hasReminder(event.id)) {
      await cancelReminder(map[event.id]);
      const next = { ...map };
      delete next[event.id];
      persist(next);
      return 'off';
    }

    const granted = await ensureNotificationPermission();
    if (!granted) return 'denied';

    const id = await scheduleRaceReminder(event, title, body);
    if (!id) return 'denied';
    persist({ ...map, [event.id]: id });
    return 'on';
  };

  const value = useMemo<RemindersValue>(() => ({ hasReminder, toggle }), [map]);

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

export function useReminders(): RemindersValue {
  const ctx = useContext(RemindersContext);
  if (!ctx) throw new Error('useReminders must be used within a RemindersProvider');
  return ctx;
}
