import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storage, StorageKeys } from '@/lib/storage';
import type { Favorite, FavoriteKind } from '@/types';

interface FavoritesValue {
  favorites: Favorite[];
  isFavorite: (kind: FavoriteKind, id: string) => boolean;
  toggle: (kind: FavoriteKind, id: string) => void;
  addMany: (items: Favorite[]) => void;
  idsOf: (kind: FavoriteKind) => string[];
}

const FavoritesContext = createContext<FavoritesValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    storage.get<Favorite[]>(StorageKeys.favorites).then((saved) => {
      if (saved) setFavorites(saved);
    });
  }, []);

  const persist = (next: Favorite[]) => {
    setFavorites(next);
    storage.set(StorageKeys.favorites, next);
  };

  const isFavorite = (kind: FavoriteKind, id: string) =>
    favorites.some((f) => f.kind === kind && f.id === id);

  const toggle = (kind: FavoriteKind, id: string) => {
    const exists = isFavorite(kind, id);
    persist(
      exists
        ? favorites.filter((f) => !(f.kind === kind && f.id === id))
        : [...favorites, { kind, id }],
    );
  };

  const addMany = (items: Favorite[]) => {
    const next = [...favorites];
    for (const item of items) {
      if (!next.some((f) => f.kind === item.kind && f.id === item.id)) next.push(item);
    }
    persist(next);
  };

  const idsOf = (kind: FavoriteKind) =>
    favorites.filter((f) => f.kind === kind).map((f) => f.id);

  const value = useMemo<FavoritesValue>(
    () => ({ favorites, isFavorite, toggle, addMany, idsOf }),
    [favorites],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within a FavoritesProvider');
  return ctx;
}
