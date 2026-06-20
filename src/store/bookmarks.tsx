import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storage, StorageKeys } from '@/lib/storage';
import type { Article } from '@/types';

interface BookmarksValue {
  saved: Article[];
  isSaved: (id: string) => boolean;
  toggle: (article: Article) => boolean; // returns true if now saved
}

const BookmarksContext = createContext<BookmarksValue | null>(null);

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Article[]>([]);

  useEffect(() => {
    storage.get<Article[]>(StorageKeys.bookmarks).then((s) => {
      if (s) setSaved(s);
    });
  }, []);

  const persist = (next: Article[]) => {
    setSaved(next);
    storage.set(StorageKeys.bookmarks, next);
  };

  const isSaved = (id: string) => saved.some((a) => a.id === id);

  const toggle = (article: Article): boolean => {
    if (isSaved(article.id)) {
      persist(saved.filter((a) => a.id !== article.id));
      return false;
    }
    persist([article, ...saved]);
    return true;
  };

  const value = useMemo<BookmarksValue>(() => ({ saved, isSaved, toggle }), [saved]);

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export function useBookmarks(): BookmarksValue {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error('useBookmarks must be used within a BookmarksProvider');
  return ctx;
}
