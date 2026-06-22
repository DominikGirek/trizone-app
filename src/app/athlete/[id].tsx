import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CodeCard } from '@/components/CodeCard';
import { FavoriteButton } from '@/components/FavoriteButton';
import { NewsCard } from '@/components/NewsCard';
import { SeriesTag } from '@/components/SeriesTag';
import { EmptyState, LoadingState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { countryFlag, formatDate, monthShort } from '@/lib/format';
import { codesForAthlete } from '@/lib/discountCodes';
import { getAthleteById } from '@/services/athletes';
import { fetchAthleteNews } from '@/services/raceNews';
import { getAthleteResults } from '@/services/races';
import type { AthleteLinks } from '@/types';

const LINK_META: { key: keyof AthleteLinks; icon: any; label: string }[] = [
  { key: 'instagram', icon: 'logo-instagram', label: 'Instagram' },
  { key: 'youtube', icon: 'logo-youtube', label: 'YouTube' },
  { key: 'podcast', icon: 'mic-outline', label: 'Podcast' },
  { key: 'website', icon: 'globe-outline', label: 'Website' },
  { key: 'strava', icon: 'fitness-outline', label: 'Strava' },
];

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
  const { data: news } = useQuery({
    queryKey: ['athleteNews', id],
    queryFn: () => fetchAthleteNews(athlete!.name),
    enabled: !!athlete,
  });

  if (isLoading) return <LoadingState />;
  if (!athlete) return <EmptyState message={t('common.noResults')} />;

  const facts: { label: string; value: string }[] = [];
  if (athlete.birthYear) {
    const age = new Date().getFullYear() - athlete.birthYear;
    facts.push({ label: t('profile.born'), value: `${athlete.birthYear} · ${t('profile.years', { count: age })}` });
  }
  if (athlete.heightCm) facts.push({ label: t('profile.height'), value: `${athlete.heightCm} cm` });
  if (athlete.weightKg) facts.push({ label: t('profile.weight'), value: `${athlete.weightKg} kg` });
  if (athlete.residence) facts.push({ label: t('profile.residence'), value: athlete.residence });

  const links = LINK_META.filter((l) => athlete.links?.[l.key]);
  const codes = codesForAthlete(athlete.id);
  const starts = (athlete.upcomingStarts ?? [])
    .filter((s) => +new Date(s.date) >= Date.now() - 86400000)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const Header = ({ title }: { title: string }) => (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
      {title.toUpperCase()}
    </ThemedText>
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: athlete.name }} />
      <ScrollView contentContainerStyle={{ paddingBottom: Spacing.six }}>
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
            {countryFlag(athlete.country)} · {t(`common.${athlete.gender}`)}
          </ThemedText>
          <View style={styles.series}>
            {athlete.series.map((s) => (
              <SeriesTag key={s} series={s} />
            ))}
          </View>
          <View style={styles.favWrap}>
            <FavoriteButton kind="athlete" id={athlete.id} size={26} />
          </View>
        </View>

        {facts.length > 0 && (
          <>
            <Header title={t('profile.facts')} />
            <View style={styles.factsGrid}>
              {facts.map((f) => (
                <View key={f.label} style={[styles.factTile, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                    {f.label}
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                    {f.value}
                  </ThemedText>
                </View>
              ))}
            </View>
          </>
        )}

        {starts.length > 0 && (
          <>
            <Header title={t('profile.upcoming')} />
            {starts.map((s, i) => (
              <Pressable
                key={i}
                onPress={() => s.url && WebBrowser.openBrowserAsync(s.url)}
                style={({ pressed }) => [
                  styles.resultRow,
                  { borderColor: theme.border },
                  pressed && !!s.url && { backgroundColor: theme.backgroundElement },
                ]}>
                <View style={styles.startDate}>
                  <ThemedText style={[styles.startDay, { color: theme.primary }]}>
                    {new Date(s.date).getDate()}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>
                    {monthShort(new Date(s.date).getMonth(), lang)}
                  </ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {s.event}
                  </ThemedText>
                  {!!s.location && (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {s.location}
                    </ThemedText>
                  )}
                </View>
                {s.series && <SeriesTag series={s.series} />}
              </Pressable>
            ))}
          </>
        )}

        {!!athlete.bio && (
          <>
            <Header title={t('profile.vita')} />
            <ThemedText type="small" style={styles.bio}>
              {athlete.bio}
            </ThemedText>
          </>
        )}

        {!!athlete.achievements?.length && (
          <>
            <Header title={t('profile.achievements')} />
            <View style={styles.achievements}>
              {athlete.achievements.map((a, i) => (
                <View key={i} style={styles.achievementRow}>
                  <Ionicons name="trophy-outline" size={16} color={theme.primary} style={{ marginTop: 2 }} />
                  <ThemedText type="small" style={{ flex: 1 }}>
                    {a}
                  </ThemedText>
                </View>
              ))}
            </View>
          </>
        )}

        {links.length > 0 && (
          <>
            <Header title={t('profile.links')} />
            <View style={styles.linkRow}>
              {links.map((l) => (
                <Pressable
                  key={l.key}
                  onPress={() => WebBrowser.openBrowserAsync(athlete.links![l.key]!)}
                  style={[styles.linkChip, { borderColor: theme.border }]}>
                  <Ionicons name={l.icon} size={18} color={theme.primary} />
                  <ThemedText type="small">{l.label}</ThemedText>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {codes.length > 0 && (
          <>
            <Header title={t('profile.codes')} />
            {codes.map((c) => (
              <CodeCard key={c.id} code={c} />
            ))}
          </>
        )}

        {!!history?.length && (
          <>
            <Header title={t('profile.results')} />
            {history.map(({ race, result }) => (
              <Pressable
                key={race.id}
                onPress={() => router.push(`/event/${race.id}`)}
                style={({ pressed }) => [
                  styles.resultRow,
                  { borderColor: theme.border },
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}>
                <ThemedText style={[styles.position, { color: theme.primary }]}>{result.position}.</ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {race.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(race.date, lang)} · {result.totalTime}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {!!news?.length && (
          <>
            <Header title={t('profile.news')} />
            {news.slice(0, 6).map((a) => (
              <NewsCard key={a.id} article={a} onPress={() => WebBrowser.openBrowserAsync(a.link)} />
            ))}
          </>
        )}

        <Pressable
          onPress={() => {
            haptics.light();
            router.push({ pathname: '/report', params: { type: 'athlete', prefill: athlete.name } });
          }}
          style={[styles.incomplete, { borderColor: theme.border }]}>
          <Ionicons name="create-outline" size={20} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold">{t('profile.incompleteTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('profile.incompleteHint')}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
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
    width: 88,
    height: 88,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  flag: { fontSize: 40 },
  name: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  series: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one, flexWrap: 'wrap', justifyContent: 'center' },
  favWrap: { marginTop: Spacing.two },
  sectionHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
    letterSpacing: 0.5,
  },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three },
  factTile: { flexGrow: 1, minWidth: 140, borderRadius: 12, padding: Spacing.three, gap: 2 },
  bio: { paddingHorizontal: Spacing.three, lineHeight: 21 },
  achievements: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  achievementRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
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
  startDate: { width: 38, alignItems: 'center' },
  startDay: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  incomplete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    margin: Spacing.three,
    marginTop: Spacing.five,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
