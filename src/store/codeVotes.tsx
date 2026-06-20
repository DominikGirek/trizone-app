import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storage, StorageKeys } from '@/lib/storage';

/**
 * The user's 👍/👎 on discount codes. v1 is local: a 👎 hides the code on this
 * device immediately. Real cross-user aggregation + the auto-cutoff (a code flies
 * out after CODE_DOWNVOTE_CUTOFF net down-votes across all users) is a backend
 * (Phase B) job — these per-device votes are kept to sync there later.
 */
export type Vote = 'up' | 'down';

interface CodeVotesValue {
  votes: Record<string, Vote>;
  voteOf: (id: string) => Vote | undefined;
  /** Set 👍/👎, or clear it if the same direction is tapped again. */
  vote: (id: string, dir: Vote) => void;
  /** Ids this device down-voted (hidden locally). */
  downvoted: string[];
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
      downvoted: Object.keys(votes).filter((id) => votes[id] === 'down'),
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
