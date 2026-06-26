import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AthleteRow } from '@/components/AthleteRow';
import { FavoriteButton } from '@/components/FavoriteButton';
import { EmptyState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBar } from '@/components/TopBar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { brandsById } from '@/lib/brands';
import { getAthletesByIds } from '@/services/athletes';
import { useFavorites } from '@/store/favorites';
import type { SeriesId } from '@/types';

// Series "crest" — short label + colour, the series analogue of the athlete avatar.
function seriesCrest(id: SeriesId): { label: string; bg: string } {
  switch (id) {
    case 'ironman':
      return { label: 'IM', bg: '#E2483C' };
    case 'ironman703':
      return { label: '70.3', bg: '#E2483C' };
    case 't100':
      return { label: 'T100', bg: '#16A0A0' };
    case 'wtcs':
      return { label: 'WT', bg: '#2F6FB0' };
    case 'challenge':
      return { label: 'CH', bg: '#C77D2E' };
    case 'pto':
      return { label: 'PTO', bg: '#6B3FA0' };
    default:
      return { label: '★', bg: '#5F5E5A' };
  }
}

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { idsOf } = useFavorites();

  const athleteIds = idsOf('athlete');
  const seriesIds = idsOf('series');
  const brandIds = idsOf('brand');

  const { data: athletes } = useQuery({
    queryKey: ['favoriteAthletes', athleteIds],
    queryFn: () => getAthletesByIds(athleteIds),
  });

  const isEmpty = athleteIds.length === 0 && seriesIds.length === 0 && brandIds.length === 0;

  return (
    <ThemedView style={styles.container}>
      <TopBar title={t('favorites.title')} />
      {isEmpty ? (
        <EmptyState icon="star-outline" message={t('favorites.hint')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: Spacing.six }}>
          {seriesIds.length > 0 && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
                {t('favorites.series').toUpperCase()}
              </ThemedText>
              {seriesIds.map((id) => {
                const c = seriesCrest(id as SeriesId);
                return (
                  <View key={id} style={[styles.row, { borderColor: theme.border }]}>
                    <View style={[styles.crest, { backgroundColor: c.bg }]}>
                      <ThemedText style={styles.crestText}>{c.label}</ThemedText>
                    </View>
                    <View style={styles.body}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {t(`series.${id}`)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.sub}>
                        {t('favorites.seriesLabel')}
                      </ThemedText>
                    </View>
                    <FavoriteButton kind="series" id={id} size={20} />
                  </View>
                );
              })}
            </>
          )}

          {brandIds.length > 0 && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
                {t('favorites.brands').toUpperCase()}
              </ThemedText>
              {brandIds.map((id) => {
                const b = brandsById[id];
                if (!b) return null;
                return (
                  <View key={id} style={[styles.row, { borderColor: theme.border }]}>
                    <View style={[styles.crest, styles.brandCrest, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText style={styles.brandEmoji}>{b.emoji}</ThemedText>
                    </View>
                    <View style={styles.body}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {b.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.sub}>
                        {t('favorites.brandLabel')}
                      </ThemedText>
                    </View>
                    <FavoriteButton kind="brand" id={id} size={20} />
                  </View>
                );
              })}
            </>
          )}

          {athleteIds.length > 0 && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
                {t('favorites.athletes').toUpperCase()}
              </ThemedText>
              {(athletes ?? []).map((a) => (
                <AthleteRow key={a.id} athlete={a} onPress={() => router.push(`/athlete/${a.id}`)} />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  crest: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  crestText: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  brandCrest: { borderRadius: 999 },
  brandEmoji: { fontSize: 20 },
  body: { flex: 1, gap: 1 },
  sub: { fontSize: 12 },
});
