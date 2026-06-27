import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { syncPush, type PushInterest } from '@/services/push';
import { useFavorites } from '@/store/favorites';
import { useMyRaces } from '@/store/myRaces';

/**
 * Keeps the backend's view of this device's interests in sync with the local stores, so hot-news
 * pushes can later target the right people. Renders nothing; no-ops on web / when the backend
 * isn't configured. Phase B / stage 2. Mounted once inside the providers in _layout.
 */
export function PushSync() {
  const { i18n } = useTranslation();
  const { idsOf } = useFavorites();
  const { races, mainId } = useMyRaces();

  const athletes = idsOf('athlete');
  const series = idsOf('series');
  const brands = idsOf('brand');
  const raceSig = races.map((r) => `${r.id}:${r.name}`).join(',');

  useEffect(() => {
    const mainRace = mainId ? races.find((r) => r.id === mainId) : undefined;
    const interests: PushInterest[] = [
      ...athletes.map((id) => ({ kind: 'athlete' as const, ref_id: id })),
      ...series.map((id) => ({ kind: 'series' as const, ref_id: id })),
      ...brands.map((id) => ({ kind: 'brand' as const, ref_id: id })),
      // Races carry their name so the backend can match headlines without the full calendar.
      ...races.map((r) => ({ kind: 'race' as const, ref_id: r.id, name: r.name })),
      ...(mainId ? [{ kind: 'main_race' as const, ref_id: mainId, name: mainRace?.name }] : []),
    ];
    syncPush(interests, i18n.language).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athletes.join(','), series.join(','), brands.join(','), raceSig, mainId, i18n.language]);

  return null;
}
