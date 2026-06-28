import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storage, StorageKeys } from '@/lib/storage';
import { TIP_SIZE, type Gender, type Picks } from '@/lib/tippspiel';
import { syncPrediction } from '@/services/tippspielSync';

/**
 * The user's own prediction per race — ONE tip, stored locally for now (P1 prototype; moves to the
 * backend in P3). Each gender is an ordered list of up to TIP_SIZE athlete ids (index 0 = predicted
 * winner). A small race-meta snapshot is denormalised so the Tippspiel hub can list "my tips" without
 * re-resolving the race. This single tip is what later feeds the global + every group leaderboard.
 */
export interface TipMeta {
  name?: string;
  date?: string;
  kind?: 'pro' | 'local';
  country?: string;
}
export interface StoredTip extends TipMeta {
  men: Picks;
  women: Picks;
}

const emptyPicks = (): Picks => Array(TIP_SIZE).fill(null);
const emptyTip = (): StoredTip => ({ men: emptyPicks(), women: emptyPicks() });
const hasAnyPick = (t: StoredTip) => [...t.men, ...t.women].some(Boolean);

interface TipsValue {
  getTip: (raceId: string) => StoredTip;
  hasTip: (raceId: string) => boolean;
  /** All races the user has tipped (≥1 pick), most-recent-meta first. */
  list: () => (StoredTip & { raceId: string })[];
  /** Set one slot; pass null to clear. An athlete already picked elsewhere in the same gender is moved. */
  setPick: (raceId: string, gender: Gender, index: number, athleteId: string | null, meta?: TipMeta) => void;
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
      hasTip: (raceId) => !!tips[raceId] && hasAnyPick(tips[raceId]),
      list: () =>
        Object.entries(tips)
          .filter(([, t]) => hasAnyPick(t))
          .map(([raceId, t]) => ({ raceId, ...t })),
      setPick: (raceId, gender, index, athleteId, meta) =>
        setTips((prev) => {
          const cur = prev[raceId] ?? emptyTip();
          const picks = [...cur[gender]];
          if (athleteId) {
            const dup = picks.indexOf(athleteId);
            if (dup !== -1 && dup !== index) picks[dup] = null;
          }
          picks[index] = athleteId;
          const next = { ...prev, [raceId]: { ...cur, ...meta, [gender]: picks } };
          storage.set(StorageKeys.tips, next);
          void syncPrediction(raceId, next[raceId]); // best-effort backend mirror (local stays source of truth)
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
