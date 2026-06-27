import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Countdown } from '@/components/Countdown';
import { FavoriteButton } from '@/components/FavoriteButton';
import { NewsCard } from '@/components/NewsCard';
import { RaceBriefingView } from '@/components/RaceBriefingView';
import { ResultsList } from '@/components/ResultsList';
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
import { cityTokens } from '@/lib/raceKey';
import {
  cleanRaceName,
  isCancelledName,
  mergeRaceNews,
  newsForRace,
  newsSaysCancelled,
  raceSearchQuery,
} from '@/lib/newsTopics';
import { getBriefing } from '@/data/raceBriefings';
import { getLocalEventById, providerLabel } from '@/services/localEvents';
import { fetchNews } from '@/services/news';
import { getRaceById, getRaceStartList, getResults, raceKey, startPointFor } from '@/services/races';
import { fetchRaceNews } from '@/services/raceNews';
import { swimVenue } from '@/services/venue';
import { useMyRaces } from '@/store/myRaces';
import { useReminders } from '@/store/reminders';
import type { DistanceOption, LocalEvent, Race } from '@/types';

/** Unified race view-model. A pro `Race` is normalised onto the (richer) local shape; lat/lon
 *  become optional because pro races may lack coordinates. */
type RaceVM = Omit<LocalEvent, 'lat' | 'lon'> & { lat?: number; lon?: number };

/** Race Center hub tabs. Only those with content are shown (no empty tabs). More slot in later
 *  (Briefing, Startliste, Karte, Live). */
type RaceTab = 'overview' | 'briefing' | 'results';

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

/** Swipeable hub-top-nav. Renders only when there are ≥2 tabs (no lonely single tab). */
function RaceTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: { id: RaceTab; label: string }[];
  active: RaceTab;
  onSelect: (id: RaceTab) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.tabBar, { borderColor: theme.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {tabs.map((tb) => {
          const on = active === tb.id;
          return (
            <Pressable key={tb.id} onPress={() => onSelect(tb.id)} style={styles.tab}>
              <ThemedText type="smallBold" style={{ color: on ? theme.text : theme.textSecondary }}>
                {tb.label}
              </ThemedText>
              <View style={[styles.tabUnderline, { backgroundColor: on ? theme.primary : 'transparent' }]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function RaceScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const isPro = kind === 'pro';
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();
  const { show } = useToast();
  const { hasReminder, toggle: toggleReminder } = useReminders();
  const { isRacing, toggle: toggleRace } = useMyRaces();
  const [tab, setTab] = useState<RaceTab>('overview');

  const { data: proRace, isLoading: proLoading } = useQuery({
    queryKey: ['race', id],
    queryFn: () => getRaceById(id),
    enabled: isPro,
  });
  const { data: localData, isLoading: localLoading } = useQuery({
    queryKey: ['localEvent', id],
    queryFn: () => getLocalEventById(id),
    enabled: !isPro,
  });

  // Pro results (in-app) — only when this race actually carries results.
  const { data: results } = useQuery({
    queryKey: ['results', id],
    queryFn: () => getResults(id),
    enabled: isPro && !!proRace?.hasResults,
  });

  // Normalise a pro Race onto the local view shape; keep raw objects for typed store calls.
  const vm: RaceVM | undefined = isPro
    ? proRace
      ? {
          id: proRace.id,
          name: proRace.name,
          town: proRace.location,
          region: t(`format.${proRace.format}`),
          country: proRace.country,
          lat: proRace.lat,
          lon: proRace.lon,
          date: proRace.date,
          status: proRace.status,
          distances: [],
          series: proRace.series,
        }
      : undefined
    : localData;

  const { data: news } = useQuery({ queryKey: ['news'], queryFn: fetchNews });
  const raceQ = vm ? raceSearchQuery(vm.name, vm.town) : '';
  const { data: localNews } = useQuery({
    queryKey: ['raceNews', raceQ],
    queryFn: () => fetchRaceNews(raceQ),
    enabled: !!raceQ,
    staleTime: 30 * 60 * 1000,
  });
  const startKey = vm ? raceKey(vm.name, vm.date) : '';
  const { data: startList } = useQuery({
    queryKey: ['startlist', startKey],
    queryFn: () => getRaceStartList(startKey),
    enabled: !!startKey,
  });
  const hasStartList = !!startList?.entries.length;

  // Local events have no curated venue → resolve the swim water body via OSM (gated to the town).
  // Series/pro races use the curated raceVenues (startPointFor) instead.
  const venueTokens = vm && !vm.series ? cityTokens(vm.name).join(' ') : '';
  const { data: geoVenue } = useQuery({
    queryKey: ['swimVenue', venueTokens, vm?.town],
    queryFn: () => swimVenue(venueTokens, vm!.town),
    enabled: !!vm && !!venueTokens,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const isLoading = isPro ? proLoading : localLoading;
  if (isLoading) return <LoadingState />;
  if (!vm) return <EmptyState message={t(isPro ? 'common.noResults' : 'local.empty')} />;

  // Filter BOTH the general feed AND the Google results so only articles that actually mention
  // this race/venue show — a small event shows no news rather than random ones.
  const raceNews = mergeRaceNews(
    newsForRace(news ?? [], vm.name, vm.town),
    newsForRace(localNews ?? [], vm.name, vm.town),
  );

  // Cancelled if the race name flags it ("… ABGESAGT!") or a recent headline says so.
  const cancelled = isCancelledName(vm.name) || newsSaysCancelled(raceNews, vm.name, vm.town);
  const cleanName = cancelled ? cleanRaceName(vm.name) : vm.name;

  const provider = providerLabel(vm.provider);
  const reminderOn = hasReminder(vm.id);
  const racing = isRacing(vm.id);

  const onRace = () => {
    haptics.light();
    const now = isPro && proRace
      ? toggleRace({ id: proRace.id, kind: 'pro', name: proRace.name, date: proRace.date, location: proRace.location, country: proRace.country })
      : toggleRace({ id: vm.id, kind: 'local', name: vm.name, date: vm.date, location: vm.town, country: vm.country });
    show(now ? t('actions.racingAddedToast') : t('actions.racingRemovedToast'), now ? 'flag' : 'flag-outline');
  };

  const onShare = () => {
    haptics.light();
    Share.share({
      message: `${vm.name} – ${vm.town} (${formatDateTime(vm.date, lang)})\nTriZone`,
    }).catch(() => {});
  };

  const onRemind = async () => {
    haptics.light();
    const entity: Race | LocalEvent = isPro && proRace ? proRace : (localData as LocalEvent);
    const res = await toggleReminder(
      entity,
      isPro ? t('reminder.title', { name: vm.name }) : vm.name,
      isPro ? t('reminder.body', { location: vm.town }) : `${vm.town} – ${t('local.live')}`,
    );
    if (res === 'on') {
      haptics.success();
      show(t('actions.reminderOn'), 'checkmark-circle');
    } else if (res === 'off') {
      show(t('actions.reminderOff'), 'checkmark-circle');
    } else {
      show(t('actions.reminderDenied'), 'checkmark-circle');
    }
  };

  const onAddToCalendar = async () => {
    if (!proRace) return;
    haptics.light();
    const ok = await addRaceToCalendar(proRace);
    if (ok) {
      haptics.success();
      show(t('actions.calendarAdded'), 'checkmark-circle');
    }
  };

  // Primary call-to-action, strictly by event phase:
  //   upcoming → "Anmeldung"   live → live ticker (else organizer)   finished → results (else organizer)
  // A *real* ticker = the native RACE RESULT ticker, or a timing-provider link from THIS event's
  // own page. We never guess/hardcode tickers — without one we link honestly to the organizer.
  const nativeTicker = !!vm.raceresultEventId;
  const isTimingUrl = (u?: string) => !!u && /racepedia|raceresult|mikatiming/i.test(u);
  const timingUrl = [vm.liveUrl, vm.resultsUrl].find(isTimingUrl);

  type Primary = {
    label: string;
    icon: 'radio-outline' | 'podium-outline' | 'create-outline' | 'open-outline';
    live: boolean;
    native?: true;
    url?: string;
    ticker?: boolean;
  };

  let primary: Primary | null = null;
  if (vm.status === 'upcoming') {
    const url = vm.registrationUrl ?? vm.websiteUrl;
    if (url) primary = { label: t('local.registration'), icon: 'create-outline', live: false, url };
  } else if (vm.status === 'live') {
    if (nativeTicker) {
      primary = { label: t('local.liveTicker'), icon: 'radio-outline', live: true, native: true, ticker: true };
    } else if (timingUrl) {
      primary = { label: t('local.liveTicker'), icon: 'radio-outline', live: true, url: timingUrl, ticker: true };
    } else {
      const url = vm.websiteUrl ?? vm.registrationUrl;
      if (url) primary = { label: t('local.website'), icon: 'open-outline', live: false, url };
    }
  } else {
    const resultsUrl = timingUrl ?? vm.resultsUrl;
    if (nativeTicker) {
      primary = { label: t('local.results'), icon: 'podium-outline', live: false, native: true, ticker: true };
    } else if (resultsUrl) {
      primary = { label: t('local.results'), icon: 'podium-outline', live: false, url: resultsUrl, ticker: true };
    } else {
      const url = vm.websiteUrl ?? vm.registrationUrl;
      if (url) primary = { label: t('local.website'), icon: 'open-outline', live: false, url };
    }
  }

  const onPrimary = () => {
    if (primary && 'native' in primary && primary.native) {
      router.push(`/live/${vm.raceresultEventId}`);
    } else if (primary && 'url' in primary) {
      openUrl(primary.url);
    }
  };

  // Exact swim-start pin: curated venue for series/pro races, else the OSM-resolved water venue
  // for local races (both verified). Otherwise a town-anchored search — never a falsely-precise pin.
  const startPoint = vm.series ? startPointFor(vm.name) : null;
  const venuePoint = startPoint ?? geoVenue ?? null;
  const localQuery = [...cityTokens(vm.name), vm.town].filter(Boolean).join(' ').trim();
  const mapsUrl = venuePoint
    ? `https://www.google.com/maps/search/?api=1&query=${venuePoint.lat},${venuePoint.lon}`
    : localQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(localQuery)}`
      : vm.lat != null && vm.lon != null
        ? `https://www.google.com/maps/search/?api=1&query=${vm.lat},${vm.lon}`
        : undefined;

  // Hub tabs — only those with content. Overview is the catch-all (weather + distances + news);
  // Ergebnisse splits out the pro results. Briefing/Startliste/Karte/Live slot in later.
  const briefing = getBriefing(vm.id);
  const hasResultsTab = isPro && !!proRace?.hasResults && !!results && results.length > 0;
  const tabs: { id: RaceTab; label: string }[] = [
    { id: 'overview', label: t('raceTab.overview') },
    ...(briefing ? [{ id: 'briefing' as RaceTab, label: t('raceTab.briefing') }] : []),
    ...(hasResultsTab ? [{ id: 'results' as RaceTab, label: t('raceTab.results') }] : []),
  ];
  const activeTab: RaceTab = tabs.some((x) => x.id === tab) ? tab : 'overview';
  const selectTab = (id: RaceTab) => {
    if (id === activeTab) return;
    haptics.light();
    LayoutAnimation.configureNext(
      LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );
    setTab(id);
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: vm.town }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={[styles.heroAccent, { backgroundColor: theme.primary }]} />
          <View style={styles.heroInner}>
            <View style={styles.topRow}>
              <View style={styles.kickerRow}>
                {!!vm.series && (
                  <View style={[styles.seriesChip, { backgroundColor: theme.primary }]}>
                    <ThemedText type="small" style={[styles.seriesChipText, { color: theme.onPrimary }]}>
                      {vm.series.toUpperCase()}
                    </ThemedText>
                  </View>
                )}
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800', fontSize: 11 }}>
                  {vm.region}
                </ThemedText>
              </View>
              <View style={styles.topRight}>
                <StatusPill status={vm.status} cancelled={cancelled} />
                {isPro && proRace && <FavoriteButton kind="series" id={proRace.series} size={22} />}
              </View>
            </View>
            <ThemedText style={[styles.name, cancelled && styles.struck]} numberOfLines={3}>
              {cleanName}
            </ThemedText>
            <View style={styles.heroMeta}>
              <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                {countryFlag(vm.country)} {vm.town} · {formatDateTime(vm.date, lang)}
              </ThemedText>
            </View>
            {vm.status === 'upcoming' && !cancelled && (
              <View style={styles.heroCountdown}>
                <Countdown date={vm.date} color={theme.text} />
              </View>
            )}
            {!!vm.organizer && (
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                {t('local.organizer')}: {vm.organizer}
              </ThemedText>
            )}
          </View>
        </View>

        {/* Primary CTA */}
        {primary && (
          <Pressable
            onPress={onPrimary}
            style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary }, pressed && { opacity: 0.85 }]}>
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
          {(hasStartList || !!vm.proStartListUrl) && (
            <ActionChip
              icon="people-outline"
              label={t('startlist.open')}
              onPress={() => (hasStartList ? router.push(`/startlist/${startKey}`) : openUrl(vm.proStartListUrl))}
            />
          )}
          {primary?.label !== t('local.registration') && (vm.registrationUrl || vm.websiteUrl) && (
            <ActionChip
              icon="create-outline"
              label={t('local.registration')}
              onPress={() => openUrl(vm.registrationUrl || vm.websiteUrl)}
            />
          )}
          {!!vm.resultsUrl && primary?.label !== t('local.results') && (
            <ActionChip icon="podium-outline" label={t('local.results')} onPress={() => openUrl(vm.resultsUrl)} />
          )}
          {!!mapsUrl && <ActionChip icon="map-outline" label={t('local.map')} onPress={() => openUrl(mapsUrl)} />}
          {vm.status !== 'finished' && (
            <ActionChip
              icon={racing ? 'flag' : 'flag-outline'}
              label={t('actions.imRacing')}
              active={racing}
              onPress={onRace}
            />
          )}
          <ActionChip
            icon={reminderOn ? 'notifications' : 'notifications-outline'}
            label={t('actions.remind')}
            onPress={onRemind}
          />
          {isPro && proRace && Platform.OS !== 'web' && (
            <ActionChip icon="calendar-outline" label={t('actions.addToCalendar')} onPress={onAddToCalendar} />
          )}
          <ActionChip icon="share-outline" label={t('actions.share')} onPress={onShare} />
        </View>

        {/* Hub tabs (only when there's more than one) */}
        {tabs.length >= 2 && <RaceTabBar tabs={tabs} active={activeTab} onSelect={selectTab} />}

        {/* Übersicht — weather + distances + race news */}
        {activeTab === 'overview' && (
          <>
            {vm.lat != null && vm.lon != null && <WeatherCard lat={vm.lat} lon={vm.lon} date={vm.date} />}

            {vm.distances.length > 0 && (
              <>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
                  {t('local.distances').toUpperCase()}
                </ThemedText>
                {vm.distances.map((d) => (
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
          </>
        )}

        {/* Briefing — curated, verified race-day fan-guide */}
        {activeTab === 'briefing' && briefing && <RaceBriefingView briefing={briefing} />}

        {/* Ergebnisse — pro results, in-app */}
        {activeTab === 'results' && hasResultsTab && (
          <View style={styles.results}>
            <ResultsList results={results!} onSelectAthlete={(aid) => router.push(`/athlete/${aid}`)} />
          </View>
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
  topRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 },
  seriesChip: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 6 },
  seriesChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: Spacing.one },
  struck: { textDecorationLine: 'line-through', opacity: 0.6 },
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
  results: { marginTop: Spacing.two },
  tabBar: { borderBottomWidth: StyleSheet.hairlineWidth, marginTop: Spacing.three },
  tabRow: { paddingHorizontal: Spacing.three, gap: Spacing.four, alignItems: 'flex-end' },
  tab: { paddingTop: Spacing.two, gap: 7 },
  tabUnderline: { height: 2.5, borderRadius: 2 },
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
