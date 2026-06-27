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
  const raceIds = races.map((r) => r.id);

  useEffect(() => {
    const interests: PushInterest[] = [
      ...athletes.map((id) => ({ kind: 'athlete' as const, ref_id: id })),
      ...series.map((id) => ({ kind: 'series' as const, ref_id: id })),
      ...brands.map((id) => ({ kind: 'brand' as const, ref_id: id })),
      ...raceIds.map((id) => ({ kind: 'race' as const, ref_id: id })),
      ...(mainId ? [{ kind: 'main_race' as const, ref_id: mainId }] : []),
    ];
    syncPush(interests, i18n.language).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athletes.join(','), series.join(','), brands.join(','), raceIds.join(','), mainId, i18n.language]);

  return null;
}
