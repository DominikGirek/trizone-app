import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storage, StorageKeys } from '@/lib/storage';

/**
 * The user's 👍/👎 on discount codes. A vote never hides the code — it just records
 * this device's rating, which shows in the card's count so others can judge the code.
 * Real cross-user aggregation (and the optional auto-cutoff for codes the crowd buries)
 * is a backend (Phase B) job — these per-device votes are kept to sync there later.
 */
export type Vote = 'up' | 'down';

interface CodeVotesValue {
  votes: Record<string, Vote>;
  voteOf: (id: string) => Vote | undefined;
  /** Set 👍/👎, or clear it if the same direction is tapped again. */
  vote: (id: string, dir: Vote) => void;
}

const CodeVotesContext = createContext<CodeVotesValue | null>(null);

export function CodeVotesProvider({ children }: { children: ReactNode }) {
  const [votes, setVotes] = useState<Record<string, Vote>>({});

  useEffect(() => {
    storage.get<Record<string, Vote>>(StorageKeys.codeVotes).then((v) => {
      if (v) setVotes(v);
    });
  }, []);

  const persist = (next: Record<string, Vote>) => {
    setVotes(next);
    storage.set(StorageKeys.codeVotes, next);
  };

  const value = useMemo<CodeVotesValue>(
    () => ({
      votes,
      voteOf: (id) => votes[id],
      vote: (id, dir) => {
        const next = { ...votes };
        if (next[id] === dir) delete next[id];
        else next[id] = dir;
        persist(next);
      },
    }),
    [votes],
  );

  return <CodeVotesContext.Provider value={value}>{children}</CodeVotesContext.Provider>;
}

export function useCodeVotes(): CodeVotesValue {
  const ctx = useContext(CodeVotesContext);
  if (!ctx) throw new Error('useCodeVotes must be used within a CodeVotesProvider');
  return ctx;
}
