import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storage, StorageKeys } from '@/lib/storage';

/**
 * The races the user is actually competing in ("Meine Rennen"), with an optional
 * main event ("Hauptrennen"). The dashboard hero counts down to the main race if
 * set, otherwise to the chronologically next one. Local-only, no backend.
 */
export interface MyRace {
  id: string;
  kind: 'pro' | 'local';
  name: string;
  date: string; // ISO
  location?: string;
  country?: string;
}

interface Persisted {
  races: MyRace[];
  mainId: string | null;
}

interface MyRacesValue {
  races: MyRace[];
  mainId: string | null;
  isRacing: (id: string) => boolean;
  isMain: (id: string) => boolean;
  /** Add/remove a race. Returns true if it is now in the list. */
  toggle: (race: MyRace) => boolean;
  /** Choose the main event, or clear it if the same id is passed again. */
  setMain: (id: string) => void;
  remove: (id: string) => void;
  /** Main race (if set & upcoming), else the soonest upcoming race. */
  next: MyRace | null;
}

const MyRacesContext = createContext<MyRacesValue | null>(null);

export function MyRacesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>({ races: [], mainId: null });

  useEffect(() => {
    storage.get<Persisted>(StorageKeys.myRaces).then((s) => {
      if (s?.races) setState({ races: s.races, mainId: s.mainId ?? null });
    });
  }, []);

  const persist = (next: Persisted) => {
    setState(next);
    storage.set(StorageKeys.myRaces, next);
  };

  const value = useMemo<MyRacesValue>(() => {
    const { races, mainId } = state;
    const now = Date.now();
    const upcoming = [...races]
      .filter((r) => +new Date(r.date) > now)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const main = mainId ? races.find((r) => r.id === mainId) ?? null : null;
    const mainFuture = main && +new Date(main.date) > now ? main : null;

    return {
      races,
      mainId,
      isRacing: (id) => races.some((r) => r.id === id),
      isMain: (id) => mainId === id,
      toggle: (race) => {
        const has = races.some((r) => r.id === race.id);
        persist(
          has
            ? { races: races.filter((r) => r.id !== race.id), mainId: mainId === race.id ? null : mainId }
            : { races: [...races, race], mainId },
        );
        return !has;
      },
      setMain: (id) => persist({ races, mainId: mainId === id ? null : id }),
      remove: (id) => persist({ races: races.filter((r) => r.id !== id), mainId: mainId === id ? null : mainId }),
      next: mainFuture ?? upcoming[0] ?? null,
    };
  }, [state]);

  return <MyRacesContext.Provider value={value}>{children}</MyRacesContext.Provider>;
}

export function useMyRaces(): MyRacesValue {
  const ctx = useContext(MyRacesContext);
  if (!ctx) throw new Error('useMyRaces must be used within a MyRacesProvider');
  return ctx;
}
