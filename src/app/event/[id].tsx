import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Countdown } from '@/components/Countdown';
import { FavoriteButton } from '@/components/FavoriteButton';
import { NewsCard } from '@/components/NewsCard';
import { ResultsList } from '@/components/ResultsList';
import { SeriesTag } from '@/components/SeriesTag';
import { StatusPill } from '@/components/StatusPill';
import { EmptyState, LoadingState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/Toast';
import { WeatherCard } from '@/components/WeatherCard';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { addRaceToCalendar } from '@/lib/calendar';
import { countryFlag, formatDateTime } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { mergeRaceNews, newsForRace, raceSearchQuery } from '@/lib/newsTopics';
import { fetchNews } from '@/services/news';
import { fetchRaceNews } from '@/services/raceNews';
import { getRaceById, getResults } from '@/services/races';
import { useMyRaces } from '@/store/myRaces';
import { useReminders } from '@/store/reminders';
import type { Race } from '@/types';

function ActionButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: active ? theme.primary : theme.backgroundElement },
        pressed && { opacity: 0.7 },
      ]}>
      <Ionicons name={icon} size={18} color={active ? theme.onPrimary : theme.primary} />
      <ThemedText type="smallBold" style={active ? { color: theme.onPrimary } : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function RemindButton({ race }: { race: Race }) {
  const { t } = useTranslation();
  const { hasReminder, toggle } = useReminders();
  const { show } = useToast();
  const active = hasReminder(race.id);

  const onPress = async () => {
    haptics.light();
    const result = await toggle(
      race,
      t('reminder.title', { name: race.name }),
      t('reminder.body', { location: race.location }),
    );
    if (result === 'on') {
      haptics.success();
      show(t('actions.reminderOn'), 'checkmark-circle');
    } else if (result === 'off') {
      show(t('actions.reminderOff'), 'checkmark-circle');
    } else {
      show(t('actions.reminderDenied'), 'checkmark-circle');
    }
  };

  return (
    <ActionButton
      icon={active ? 'notifications' : 'notifications-outline'}
      label={t('actions.remind')}
      onPress={onPress}
      active={active}
    />
  );
}

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();
  const { show } = useToast();
  const { isRacing, toggle: toggleRace } = useMyRaces();

  const { data: race, isLoading } = useQuery({
    queryKey: ['race', id],
    queryFn: () => getRaceById(id),
  });
  const { data: results } = useQuery({
    queryKey: ['results', id],
    queryFn: () => getResults(id),
    enabled: !!race?.hasResults,
  });
  const { data: news } = useQuery({ queryKey: ['news'], queryFn: fetchNews });
  const raceQ = race ? raceSearchQuery(race.name, race.location) : '';
  const { data: localNews } = useQuery({
    queryKey: ['raceNews', raceQ],
    queryFn: () => fetchRaceNews(raceQ),
    enabled: !!raceQ,
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) return <LoadingState />;
  if (!race) return <EmptyState message={t('common.noResults')} />;

  const raceNews = mergeRaceNews(
    newsForRace(news ?? [], race.name, race.location),
    newsForRace(localNews ?? [], race.name, race.location),
  );

  const onShare = (r: Race) => {
    haptics.light();
    Share.share({
      message: `${r.name} – ${r.location} (${formatDateTime(r.date, lang)})\n${t('more.about')} · TriZone`,
    }).catch(() => {});
  };

  const onAddToCalendar = async (r: Race) => {
    haptics.light();
    const ok = await addRaceToCalendar(r);
    if (ok) {
      haptics.success();
      show(t('actions.calendarAdded'), 'checkmark-circle');
    }
  };

  const onRace = (r: Race) => {
    haptics.light();
    const now = toggleRace({ id: r.id, kind: 'pro', name: r.name, date: r.date, location: r.location, country: r.country });
    show(now ? t('actions.racingAddedToast') : t('actions.racingRemovedToast'), now ? 'flag' : 'flag-outline');
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t(`series.${race.series}`) }} />
      <ScrollView>
        <View style={[styles.header, { borderColor: theme.border }]}>
          <View style={styles.topRow}>
            <SeriesTag series={race.series} />
            <View style={styles.topRight}>
              <StatusPill status={race.status} />
              <FavoriteButton kind="series" id={race.series} size={22} />
            </View>
          </View>
          <ThemedText style={styles.name}>{race.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {countryFlag(race.country)} {race.location} · {t(`format.${race.format}`)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDateTime(race.date, lang)}
          </ThemedText>
          {race.status !== 'finished' && (
            <View style={styles.countdown}>
              <Countdown date={race.date} />
            </View>
          )}

          <View style={styles.actions}>
            <ActionButton icon="share-outline" label={t('actions.share')} onPress={() => onShare(race)} />
            {race.status !== 'finished' && (
              <ActionButton
                icon={isRacing(race.id) ? 'flag' : 'flag-outline'}
                label={t('actions.imRacing')}
                active={isRacing(race.id)}
                onPress={() => onRace(race)}
              />
            )}
            {Platform.OS !== 'web' && race.status !== 'finished' && <RemindButton race={race} />}
            {Platform.OS !== 'web' && (
              <ActionButton
                icon="calendar-outline"
                label={t('actions.addToCalendar')}
                onPress={() => onAddToCalendar(race)}
              />
            )}
          </View>
        </View>

        {race.lat != null && race.lon != null && (
          <WeatherCard lat={race.lat} lon={race.lon} date={race.date} />
        )}

        {race.hasResults && results && results.length > 0 && (
          <View style={styles.results}>
            <ResultsList results={results} onSelectAthlete={(aid) => router.push(`/athlete/${aid}`)} />
          </View>
        )}

        {raceNews.length > 0 && (
          <View>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.newsHeader}>
              {t('news.aboutRace').toUpperCase()}
            </ThemedText>
            {raceNews.map((a) => (
              <NewsCard key={a.id} article={a} onPress={() => a.link && WebBrowser.openBrowserAsync(a.link)} />
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: Spacing.three,
    gap: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: Spacing.one },
  countdown: { marginTop: Spacing.three },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  results: { marginTop: Spacing.two },
  newsHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
    letterSpacing: 0.5,
  },
});
