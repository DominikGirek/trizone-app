import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AthleteRow } from '@/components/AthleteRow';
import { FavoriteButton } from '@/components/FavoriteButton';
import { SeriesTag } from '@/components/SeriesTag';
import { EmptyState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBar } from '@/components/TopBar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { brandsById } from '@/lib/brands';
import { getAthletesByIds } from '@/services/athletes';
import { useFavorites } from '@/store/favorites';

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
        <ScrollView>
          {seriesIds.length > 0 && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
                {t('favorites.series').toUpperCase()}
              </ThemedText>
              {seriesIds.map((id) => (
                <View key={id} style={[styles.seriesRow, { borderColor: theme.border }]}>
                  <SeriesTag series={id as any} />
                  <View style={{ flex: 1 }} />
                  <FavoriteButton kind="series" id={id} size={20} />
                </View>
              ))}
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
                  <View key={id} style={[styles.seriesRow, { borderColor: theme.border }]}>
                    <ThemedText style={{ fontSize: 18 }}>{b.emoji}</ThemedText>
                    <ThemedText type="smallBold" style={{ marginLeft: Spacing.two }}>
                      {b.name}
                    </ThemedText>
                    <View style={{ flex: 1 }} />
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
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
