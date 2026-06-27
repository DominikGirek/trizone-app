import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storage, StorageKeys } from '@/lib/storage';

/**
 * The user's 👍/👎 on news articles (keyed by article id). A vote is a rating — it never hides
 * the article; the card shows the up/down counts so others can gauge how a story landed. Real
 * cross-user aggregation is a backend (Phase B) job — these per-device votes are kept to sync
 * there later. Mirrors the discount-code vote store.
 */
export type Vote = 'up' | 'down';

interface NewsVotesValue {
  votes: Record<string, Vote>;
  voteOf: (id: string) => Vote | undefined;
  /** Set 👍/👎, or clear it if the same direction is tapped again. */
  vote: (id: string, dir: Vote) => void;
}

const NewsVotesContext = createContext<NewsVotesValue | null>(null);

export function NewsVotesProvider({ children }: { children: ReactNode }) {
  const [votes, setVotes] = useState<Record<string, Vote>>({});

  useEffect(() => {
    storage.get<Record<string, Vote>>(StorageKeys.newsVotes).then((v) => {
      if (v) setVotes(v);
    });
  }, []);

  const persist = (next: Record<string, Vote>) => {
    setVotes(next);
    storage.set(StorageKeys.newsVotes, next);
  };

  const value = useMemo<NewsVotesValue>(
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

  return <NewsVotesContext.Provider value={value}>{children}</NewsVotesContext.Provider>;
}

export function useNewsVotes(): NewsVotesValue {
  const ctx = useContext(NewsVotesContext);
  if (!ctx) throw new Error('useNewsVotes must be used within a NewsVotesProvider');
  return ctx;
}
