import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/FavoriteButton';
import { SeriesTag } from '@/components/SeriesTag';
import { EmptyState, LoadingState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { countryFlag, formatDate } from '@/lib/format';
import { getAthleteById } from '@/services/athletes';
import { getAthleteResults } from '@/services/races';

export default function AthleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();

  const { data: athlete, isLoading } = useQuery({
    queryKey: ['athlete', id],
    queryFn: () => getAthleteById(id),
  });
  const { data: history } = useQuery({
    queryKey: ['athleteResults', id],
    queryFn: () => getAthleteResults(id),
  });

  if (isLoading) return <LoadingState />;
  if (!athlete) return <EmptyState message={t('common.noResults')} />;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: athlete.name }} />
      <ScrollView>
        <View style={[styles.header, { borderColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
            {athlete.photoUrl ? (
              <Image source={{ uri: athlete.photoUrl }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <ThemedText style={styles.flag}>{countryFlag(athlete.country)}</ThemedText>
            )}
          </View>
          <ThemedText style={styles.name}>{athlete.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t(`common.${athlete.gender}`)}
          </ThemedText>
          <View style={styles.series}>
            {athlete.series.map((s) => (
              <SeriesTag key={s} series={s} />
            ))}
          </View>
          <View style={styles.favWrap}>
            <FavoriteButton kind="athlete" id={athlete.id} size={26} />
          </View>
          {!!athlete.bio && (
            <ThemedText type="small" style={styles.bio}>
              {athlete.bio}
            </ThemedText>
          )}
        </View>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
          {t('results.raceResults').toUpperCase()}
        </ThemedText>
        {history && history.length > 0 ? (
          history.map(({ race, result }) => (
            <Pressable
              key={race.id}
              onPress={() => router.push(`/event/${race.id}`)}
              style={({ pressed }) => [
                styles.resultRow,
                { borderColor: theme.border },
                pressed && { backgroundColor: theme.backgroundElement },
              ]}>
              <ThemedText style={[styles.position, { color: theme.primary }]}>
                {result.position}.
              </ThemedText>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {race.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(race.date, lang)} · {result.totalTime}
                </ThemedText>
              </View>
            </Pressable>
          ))
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.noResults}>
            {t('results.noResultsYet')}
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  flag: { fontSize: 36 },
  name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  series: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  favWrap: { marginTop: Spacing.two },
  bio: { textAlign: 'center', marginTop: Spacing.two, maxWidth: 320, lineHeight: 20 },
  sectionHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
    letterSpacing: 0.5,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  position: { fontSize: 18, fontWeight: '800', width: 30 },
  noResults: { padding: Spacing.three },
});
