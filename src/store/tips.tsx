import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storage, StorageKeys } from '@/lib/storage';
import { TIP_SIZE, type Gender, type Picks } from '@/lib/tippspiel';

/**
 * The user's own prediction per race — ONE tip, stored locally for now (P1 prototype; moves to the
 * backend in P3). Shape: `{ [raceId]: { men: Picks, women: Picks } }` where each gender is an ordered
 * list of up to TIP_SIZE athlete ids (index 0 = predicted winner). This single tip is what later
 * feeds the global + every group leaderboard.
 */
export interface StoredTip {
  men: Picks;
  women: Picks;
}

const emptyPicks = (): Picks => Array(TIP_SIZE).fill(null);
const emptyTip = (): StoredTip => ({ men: emptyPicks(), women: emptyPicks() });

interface TipsValue {
  getTip: (raceId: string) => StoredTip;
  hasTip: (raceId: string) => boolean;
  /** Set one slot; pass null to clear. An athlete already picked elsewhere in the same gender is moved. */
  setPick: (raceId: string, gender: Gender, index: number, athleteId: string | null) => void;
}

const TipsContext = createContext<TipsValue | null>(null);

export function TipsProvider({ children }: { children: ReactNode }) {
  const [tips, setTips] = useState<Record<string, StoredTip>>({});

  useEffect(() => {
    storage.get<Record<string, StoredTip>>(StorageKeys.tips).then((v) => {
      if (v) setTips(v);
    });
  }, []);

  const value = useMemo<TipsValue>(
    () => ({
      getTip: (raceId) => tips[raceId] ?? emptyTip(),
      hasTip: (raceId) => {
        const t = tips[raceId];
        return !!t && [...t.men, ...t.women].some(Boolean);
      },
      setPick: (raceId, gender, index, athleteId) =>
        setTips((prev) => {
          const cur = prev[raceId] ?? emptyTip();
          const picks = [...cur[gender]];
          // keep a clean ordered list of length TIP_SIZE; an athlete can sit in only one slot
          if (athleteId) {
            const dup = picks.indexOf(athleteId);
            if (dup !== -1 && dup !== index) picks[dup] = null;
          }
          picks[index] = athleteId;
          const next = { ...prev, [raceId]: { ...cur, [gender]: picks } };
          storage.set(StorageKeys.tips, next);
          return next;
        }),
    }),
    [tips],
  );

  return <TipsContext.Provider value={value}>{children}</TipsContext.Provider>;
}

export function useTips(): TipsValue {
  const ctx = useContext(TipsContext);
  if (!ctx) throw new Error('useTips must be used within a TipsProvider');
  return ctx;
}
