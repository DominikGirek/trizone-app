import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Countdown } from '@/components/Countdown';
import { NewsCard } from '@/components/NewsCard';
import { StatusPill } from '@/components/StatusPill';
import { EmptyState, LoadingState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/Toast';
import { WeatherCard } from '@/components/WeatherCard';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { countryFlag, formatDateTime } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { mergeRaceNews, newsForRace, raceSearchQuery } from '@/lib/newsTopics';
import { fetchNews } from '@/services/news';
import { fetchRaceNews } from '@/services/raceNews';
import { getLocalEventById, providerLabel } from '@/services/localEvents';
import { cityTokens } from '@/lib/raceKey';
import { getRaceStartList, raceKey, startPointFor } from '@/services/races';
import { useMyRaces } from '@/store/myRaces';
import { useReminders } from '@/store/reminders';
import type { DistanceOption, LocalEvent } from '@/types';

function openUrl(url?: string) {
  if (url) WebBrowser.openBrowserAsync(url);
}

function ActionChip({
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
        styles.chip,
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

function DistanceRow({ d }: { d: DistanceOption }) {
  const theme = useTheme();
  const parts = [
    d.swim != null ? `🏊 ${d.swim} km` : null,
    d.bike != null ? `🚴 ${d.bike} km` : null,
    d.run != null ? `🏃 ${d.run} km` : null,
  ].filter(Boolean);
  return (
    <View style={[styles.distRow, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">{d.label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {parts.join('   ')}
      </ThemedText>
    </View>
  );
}

export default function LocalEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();
  const { show } = useToast();
  const { hasReminder, toggle } = useReminders();
  const { isRacing, toggle: toggleRace } = useMyRaces();

  const { data: event, isLoading } = useQuery({
    queryKey: ['localEvent', id],
    queryFn: () => getLocalEventById(id),
  });
  const { data: news } = useQuery({ queryKey: ['news'], queryFn: fetchNews });
  const raceQ = event ? raceSearchQuery(event.name, event.town) : '';
  const { data: localNews } = useQuery({
    queryKey: ['raceNews', raceQ],
    queryFn: () => fetchRaceNews(raceQ),
    enabled: !!raceQ,
    staleTime: 30 * 60 * 1000,
  });
  const startKey = event ? raceKey(event.name, event.date) : '';
  const { data: startList } = useQuery({
    queryKey: ['startlist', startKey],
    queryFn: () => getRaceStartList(startKey),
    enabled: !!startKey,
  });
  const hasStartList = !!startList?.entries.length;

  if (isLoading) return <LoadingState />;
  if (!event) return <EmptyState message={t('local.empty')} />;

  // Filter BOTH the general feed AND the Google results so only articles that actually
  // mention this race/venue show — a small local event shows no news rather than random ones.
  const raceNews = mergeRaceNews(
    newsForRace(news ?? [], event.name, event.town),
    newsForRace(localNews ?? [], event.name, event.town),
  );

  const provider = providerLabel(event.provider);
  const reminderOn = hasReminder(event.id);
  const racing = isRacing(event.id);

  const onRace = (e: LocalEvent) => {
    haptics.light();
    const now = toggleRace({ id: e.id, kind: 'local', name: e.name, date: e.date, location: e.town, country: e.country });
    show(now ? t('actions.racingAddedToast') : t('actions.racingRemovedToast'), now ? 'flag' : 'flag-outline');
  };

  const onShare = (e: LocalEvent) => {
    haptics.light();
    Share.share({
      message: `${e.name} – ${e.town} (${formatDateTime(e.date, lang)})\nTriZone`,
    }).catch(() => {});
  };

  const onRemind = async (e: LocalEvent) => {
    haptics.light();
    const res = await toggle(e, e.name, `${e.town} – ${t('local.live')}`);
    if (res === 'on') {
      haptics.success();
      show(t('actions.reminderOn'), 'checkmark-circle');
    } else if (res === 'off') {
      show(t('actions.reminderOff'), 'checkmark-circle');
    } else {
      show(t('actions.reminderDenied'), 'checkmark-circle');
    }
  };

  // Primary call-to-action, strictly by event phase:
  //   upcoming → "Anmeldung"   live → live ticker (else organizer)   finished → results (else organizer)
  // A *real* ticker = the native RACE RESULT ticker, or a timing-provider link
  // taken from THIS event's own page. We never guess/hardcode tickers — a wrong
  // ticker is worse than none — so without one we link honestly to the organizer.
  const nativeTicker = !!event.raceresultEventId;
  const isTimingUrl = (u?: string) => !!u && /racepedia|raceresult|mikatiming/i.test(u);
  const timingUrl = [event.liveUrl, event.resultsUrl].find(isTimingUrl);

  type Primary = {
    label: string;
    icon: 'radio-outline' | 'podium-outline' | 'create-outline' | 'open-outline';
    live: boolean;
    native?: true;
    url?: string;
    ticker?: boolean; // points at a real ticker/results provider (→ show "via …")
  };

  let primary: Primary | null = null;
  if (event.status === 'upcoming') {
    const url = event.registrationUrl ?? event.websiteUrl;
    if (url) primary = { label: t('local.registration'), icon: 'create-outline', live: false, url };
  } else if (event.status === 'live') {
    if (nativeTicker) {
      primary = { label: t('local.liveTicker'), icon: 'radio-outline', live: true, native: true, ticker: true };
    } else if (timingUrl) {
      primary = { label: t('local.liveTicker'), icon: 'radio-outline', live: true, url: timingUrl, ticker: true };
    } else {
      const url = event.websiteUrl ?? event.registrationUrl;
      if (url) primary = { label: t('local.website'), icon: 'open-outline', live: false, url };
    }
  } else {
    // finished
    const resultsUrl = timingUrl ?? event.resultsUrl;
    if (nativeTicker) {
      primary = { label: t('local.results'), icon: 'podium-outline', live: false, native: true, ticker: true };
    } else if (resultsUrl) {
      primary = { label: t('local.results'), icon: 'podium-outline', live: false, url: resultsUrl, ticker: true };
    } else {
      const url = event.websiteUrl ?? event.registrationUrl;
      if (url) primary = { label: t('local.website'), icon: 'open-outline', live: false, url };
    }
  }

  const onPrimary = () => {
    if (primary && 'native' in primary && primary.native) {
      router.push(`/live/${event.raceresultEventId}`);
    } else if (primary && 'url' in primary) {
      openUrl(primary.url);
    }
  };

  // Verified swim-start coordinates ONLY for the branded series races (raceVenues is keyed
  // by city token — applying it to a local DTU event that merely shares a city, e.g. a small
  // Hamburg/Frankfurt race, would drop a WRONG pin at the big race's venue). Local events
  // instead use a town-anchored Google search ("name town") — never a falsely-precise pin.
  const startPoint = event.series ? startPointFor(event.name) : null;
  // For local events search the distinctive venue/name token(s) + town — Google resolves a
  // named venue ("Aasee Bocholt") to the actual swim spot, while the raw "37. … Triathlon"
  // string is noisy. Falls back to the town centroid only when no distinctive token exists.
  const localQuery = [...cityTokens(event.name), event.town].filter(Boolean).join(' ').trim();
  const mapsUrl = startPoint
    ? `https://www.google.com/maps/search/?api=1&query=${startPoint.lat},${startPoint.lon}`
    : localQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(localQuery)}`
      : `https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lon}`;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: event.town }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={[styles.heroAccent, { backgroundColor: theme.primary }]} />
          <View style={styles.heroInner}>
            <View style={styles.topRow}>
              <View style={styles.kickerRow}>
                {!!event.series && (
                  <View style={[styles.seriesChip, { backgroundColor: theme.primary }]}>
                    <ThemedText type="small" style={[styles.seriesChipText, { color: theme.onPrimary }]}>
                      {event.series.toUpperCase()}
                    </ThemedText>
                  </View>
                )}
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800', fontSize: 11 }}>
                  {event.region}
                </ThemedText>
              </View>
              <StatusPill status={event.status} />
            </View>
            <ThemedText style={styles.name} numberOfLines={3}>
              {event.name}
            </ThemedText>
            <View style={styles.heroMeta}>
              <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                {countryFlag(event.country)} {event.town} · {formatDateTime(event.date, lang)}
              </ThemedText>
            </View>
            {event.status === 'upcoming' && (
              <View style={styles.heroCountdown}>
                <Countdown date={event.date} color={theme.text} />
              </View>
            )}
            {!!event.organizer && (
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                {t('local.organizer')}: {event.organizer}
              </ThemedText>
            )}
          </View>
        </View>

        {/* Primary CTA */}
        {primary && (
          <Pressable
            onPress={onPrimary}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: theme.primary },
              pressed && { opacity: 0.85 },
            ]}>
            {primary.live && <View style={[styles.liveDot, { backgroundColor: theme.onPrimary }]} />}
            <Ionicons name={primary.icon} size={20} color={theme.onPrimary} />
            <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 }}>
              {primary.label}
            </ThemedText>
            {primary.ticker && provider && (
              <ThemedText type="small" style={{ color: theme.onPrimary, opacity: 0.8 }}>
                {t('local.via', { provider })}
              </ThemedText>
            )}
          </Pressable>
        )}

        {/* Secondary actions */}
        <View style={styles.actions}>
          {/* Pro start list — ONLY for races that actually have a pro field (our own data, or
              a known pro race via proStartListUrl). Regional age-group races (e.g. IRONMAN 70.3
              Duisburg) have no pro field → no button. With our own data we open the in-app list;
              otherwise we deep-link to the official pro start list (a link, not scraping). */}
          {(hasStartList || !!event.proStartListUrl) && (
            <ActionChip
              icon="people-outline"
              label={t('startlist.open')}
              onPress={() =>
                hasStartList ? router.push(`/startlist/${startKey}`) : openUrl(event.proStartListUrl)
              }
            />
          )}
          {primary?.label !== t('local.registration') && (event.registrationUrl || event.websiteUrl) && (
            <ActionChip
              icon="create-outline"
              label={t('local.registration')}
              onPress={() => openUrl(event.registrationUrl || event.websiteUrl)}
            />
          )}
          {!!event.resultsUrl && primary?.label !== t('local.results') && (
            <ActionChip icon="podium-outline" label={t('local.results')} onPress={() => openUrl(event.resultsUrl)} />
          )}
          <ActionChip icon="map-outline" label={t('local.map')} onPress={() => openUrl(mapsUrl)} />
          {event.status !== 'finished' && (
            <ActionChip
              icon={racing ? 'flag' : 'flag-outline'}
              label={t('actions.imRacing')}
              active={racing}
              onPress={() => onRace(event)}
            />
          )}
          <ActionChip
            icon={reminderOn ? 'notifications' : 'notifications-outline'}
            label={t('actions.remind')}
            onPress={() => onRemind(event)}
          />
          <ActionChip icon="share-outline" label={t('actions.share')} onPress={() => onShare(event)} />
        </View>

        {/* Weather */}
        <WeatherCard lat={event.lat} lon={event.lon} date={event.date} />

        {/* Distances (only when known) */}
        {event.distances.length > 0 && (
          <>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
              {t('local.distances').toUpperCase()}
            </ThemedText>
            {event.distances.map((d) => (
              <DistanceRow key={d.label} d={d} />
            ))}
          </>
        )}

        {raceNews.length > 0 && (
          <>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
              {t('news.aboutRace').toUpperCase()}
            </ThemedText>
            {raceNews.map((a) => (
              <NewsCard key={a.id} article={a} onPress={() => openUrl(a.link)} />
            ))}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Spacing.five },
  hero: {
    flexDirection: 'row',
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  heroAccent: { width: 5, alignSelf: 'stretch' },
  heroInner: { flex: 1, padding: Spacing.three, gap: Spacing.one },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 },
  seriesChip: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 6 },
  seriesChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: Spacing.one },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  heroCountdown: { marginTop: Spacing.two },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 14,
  },
  liveDot: { width: 8, height: 8, borderRadius: 999 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.three,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
    letterSpacing: 0.5,
  },
  distRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
});
