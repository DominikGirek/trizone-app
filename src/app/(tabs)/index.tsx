import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Countdown } from '@/components/Countdown';
import { LocalEventCard } from '@/components/LocalEventCard';
import { NewsCard } from '@/components/NewsCard';
import { Pill } from '@/components/Pill';
import { NewsListSkeleton } from '@/components/Skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBar } from '@/components/TopBar';
import { Spacing } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { countryFlag, formatDate, timeAgo } from '@/lib/format';
import { pickForYou } from '@/lib/newsTopics';
import { getAthletesByIds } from '@/services/athletes';
import { getAllEvents, type FeedItem } from '@/services/events';
import { fetchNews } from '@/services/news';
import { useFavorites } from '@/store/favorites';
import { useMyRaces } from '@/store/myRaces';

const dateOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.date : i.event.date);
const statusOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.status : i.event.status);
const nameOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.name : i.event.name);
const placeOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.location : i.event.town);
const ctryOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.country : i.event.country);
const distOf = (i: FeedItem) => (i.kind === 'pro' ? undefined : i.event.distanceKm);

// A followed athlete with a result/win in a fresh headline → red "athlete moment".
const RESULT_RE = /\b(gewinnt|siegt|sieg|sieger|weltmeister|holt|triumph|champion|wins?|victory|podium|titel|rekord)\b/i;

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
          {title.toUpperCase()}
        </ThemedText>
        {actionLabel && onAction && (
          <Pressable onPress={onAction} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {actionLabel} ›
            </ThemedText>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();
  const { coords } = useLocation();
  const { idsOf, favorites } = useFavorites();
  const { next: myNext, isMain, races: myRaces } = useMyRaces();

  const athleteIds = idsOf('athlete');
  const seriesIds = idsOf('series');
  const brandIds = idsOf('brand');

  const { data: events } = useQuery({
    queryKey: ['allEvents', coords?.lat, coords?.lon],
    queryFn: () => getAllEvents(coords),
  });
  const { data: news, isLoading: newsLoading } = useQuery({ queryKey: ['news'], queryFn: fetchNews });
  const { data: favAthletes } = useQuery({
    queryKey: ['favoriteAthletes', athleteIds],
    queryFn: () => getAthletesByIds(athleteIds),
    enabled: athleteIds.length > 0,
  });
  const athleteNames = useMemo(() => (favAthletes ?? []).map((a) => a.name), [favAthletes]);

  const all = useMemo(() => events ?? [], [events]);
  const hasInterests = athleteNames.length > 0 || seriesIds.length > 0 || brandIds.length > 0;

  // Smart hero cascade (priority high → low). Red is reserved for the urgent states.
  const relevantLive = useMemo(
    () =>
      all.find(
        (i) => statusOf(i) === 'live' && (i.kind !== 'local' || (distOf(i) != null && distOf(i)! <= 75)),
      ),
    [all],
  );

  const athleteMoment = useMemo(() => {
    if (relevantLive || !athleteNames.length) return null;
    const cutoff = Date.now() - 48 * 3600 * 1000;
    return (
      (news ?? []).find((a) => {
        if (+new Date(a.publishedAt) < cutoff || !RESULT_RE.test(a.title)) return false;
        const hay = `${a.title} ${a.summary}`.toLowerCase();
        return athleteNames.some((n) => {
          const nn = n.toLowerCase();
          const last = nn.split(/\s+/).pop()!;
          return hay.includes(nn) || (last.length > 3 && hay.includes(last));
        });
      }) ?? null
    );
  }, [relevantLive, news, athleteNames]);

  const nextDays = myNext ? Math.ceil((+new Date(myNext.date) - Date.now()) / 86400000) : null;
  const raceWeek = !!myNext && nextDays != null && nextDays >= 0 && nextDays <= 7;

  // — "Near you" list.
  const nearby = useMemo(() => {
    const items = all.filter(
      (i): i is Extract<FeedItem, { kind: 'local' | 'series' }> =>
        (i.kind === 'local' || i.kind === 'series') && statusOf(i) !== 'finished',
    );
    items.sort((a, b) => {
      const da = distOf(a);
      const db = distOf(b);
      if (coords && da != null && db != null) return da - db;
      return +new Date(dateOf(a)) - +new Date(dateOf(b));
    });
    return items.slice(0, 2);
  }, [all, coords]);

  // — Personalized, language-filtered top news.
  const uiLang = lang.startsWith('de') ? 'de' : 'en';
  // Discovery mix: relevant but rotating, so the dashboard never feels static.
  // Seed = per-session + a 30-min time bucket → stable within a render, but a
  // different selection across app opens and over the day.
  const [sessionSeed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const newsBucket = Math.floor(Date.now() / (30 * 60 * 1000));
  const topNews = useMemo(() => {
    const arr = news ?? [];
    let list = arr.filter((a) => a.lang === uiLang);
    if (!list.length) list = arr;
    return pickForYou(list, { athleteNames, seriesIds, brandIds }, sessionSeed + newsBucket, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news, uiLang, athleteNames.join('|'), seriesIds.join('|'), brandIds.join('|'), sessionSeed, newsBucket]);

  const openArticle = (link: string) => link && WebBrowser.openBrowserAsync(link);
  const openItem = (i: FeedItem) =>
    i.kind === 'pro' ? router.push(`/event/${i.id}`) : router.push(`/local/${i.id}`);
  const openMyNext = () =>
    myNext && (myNext.kind === 'pro' ? router.push(`/event/${myNext.id}`) : router.push(`/local/${myNext.id}`));

  // Shared red hero card for a race countdown (race-week + normal countdown).
  const renderRaceHero = (pillLabel: string) =>
    myNext && (
      <Pressable
        onPress={openMyNext}
        style={({ pressed }) => [styles.hero, { backgroundColor: theme.primary }, pressed && { opacity: 0.9 }]}>
        <View style={styles.heroTop}>
          <Pill label={pillLabel} color={theme.primary} background={theme.onPrimary} dot={raceWeek} />
          <ThemedText type="small" style={{ color: theme.onPrimary, opacity: 0.9 }}>
            {countryFlag(myNext.country ?? 'DE')} {myNext.location}
          </ThemedText>
        </View>
        <ThemedText style={[styles.heroName, { color: theme.onPrimary }]} numberOfLines={2}>
          {myNext.name}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.onPrimary, opacity: 0.9, marginBottom: Spacing.two }}>
          {formatDate(myNext.date, lang)}
        </ThemedText>
        <Countdown date={myNext.date} color={theme.onPrimary} />
      </Pressable>
    );

  return (
    <ThemedView style={styles.container}>
      <TopBar
        title={t('tabs.home')}
        right={
          <Pressable
            onPress={() => router.push('/following')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('following.title')}>
            <Ionicons name="person-circle-outline" size={26} color={theme.text} />
            {favorites.length > 0 && (
              <View style={[styles.followBadge, { backgroundColor: theme.primary }]}>
                <ThemedText style={[styles.followBadgeText, { color: theme.onPrimary }]}>
                  {favorites.length}
                </ThemedText>
              </View>
            )}
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Smart hero — one prominent tile, red for the urgent states. */}
        {relevantLive ? (
          <Pressable
            onPress={() =>
              relevantLive.kind !== 'pro' && relevantLive.event.raceresultEventId
                ? router.push(`/live/${relevantLive.event.raceresultEventId}`)
                : openItem(relevantLive)
            }
            style={({ pressed }) => [styles.hero, { backgroundColor: theme.primary }, pressed && { opacity: 0.9 }]}>
            <View style={styles.heroTop}>
              <Pill label={t('dashboard.liveNow')} color={theme.primary} background={theme.onPrimary} dot />
              <Ionicons name="radio-outline" size={20} color={theme.onPrimary} />
            </View>
            <ThemedText style={[styles.heroName, { color: theme.onPrimary }]} numberOfLines={2}>
              {nameOf(relevantLive)}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.onPrimary, opacity: 0.9 }}>
              {countryFlag(ctryOf(relevantLive))} {placeOf(relevantLive)} · {t('dashboard.watchLive')}
            </ThemedText>
          </Pressable>
        ) : raceWeek ? (
          renderRaceHero(t('dashboard.raceWeek'))
        ) : athleteMoment ? (
          <Pressable
            onPress={() => openArticle(athleteMoment.link)}
            style={({ pressed }) => [styles.hero, { backgroundColor: theme.primary }, pressed && { opacity: 0.9 }]}>
            <View style={styles.heroTop}>
              <Pill label={t('dashboard.athleteMoment')} color={theme.primary} background={theme.onPrimary} />
              <Ionicons name="trophy-outline" size={20} color={theme.onPrimary} />
            </View>
            <ThemedText style={[styles.heroName, { color: theme.onPrimary, fontSize: 19 }]} numberOfLines={3}>
              {athleteMoment.title}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.onPrimary, opacity: 0.9 }}>
              {athleteMoment.source} · {timeAgo(athleteMoment.publishedAt, lang)}
            </ThemedText>
          </Pressable>
        ) : myNext ? (
          renderRaceHero(isMain(myNext.id) ? t('dashboard.mainRace') : t('dashboard.myRace'))
        ) : (
          <Pressable
            onPress={() => router.push('/events')}
            style={({ pressed }) => [
              styles.prompt,
              { borderColor: theme.primary, backgroundColor: theme.backgroundElement },
              pressed && { opacity: 0.85 },
            ]}>
            <View style={[styles.promptIcon, { backgroundColor: theme.primary }]}>
              <Ionicons name="flag" size={20} color={theme.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" style={{ fontSize: 16 }}>
                {t('dashboard.askTitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('dashboard.askSubtitle')}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.primary} />
          </Pressable>
        )}

        {/* Manage my races */}
        {myRaces.length > 0 && (
          <Pressable onPress={() => router.push('/my-races')} style={styles.manageRow} hitSlop={6}>
            <Ionicons name="flag-outline" size={15} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              {t('myRaces.manageCount', { count: myRaces.length })} ›
            </ThemedText>
          </Pressable>
        )}

        {/* Near you */}
        {nearby.length > 0 && (
          <Section title={t('local.nearby')} actionLabel={t('dashboard.seeAll')} onAction={() => router.push('/events')}>
            {nearby.map((i) => (
              <LocalEventCard key={i.id} event={i.event} onPress={() => openItem(i)} />
            ))}
          </Section>
        )}

        {/* Favorites */}
        <Section
          title={t('favorites.title')}
          actionLabel={athleteIds.length ? t('dashboard.seeAll') : undefined}
          onAction={athleteIds.length ? () => router.push('/favorites') : undefined}>
          {athleteIds.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favRow}>
              {(favAthletes ?? []).map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => router.push(`/athlete/${a.id}`)}
                  style={[styles.favChip, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={styles.favFlag}>{countryFlag(a.country)}</ThemedText>
                  <ThemedText type="small" numberOfLines={1} style={styles.favName}>
                    {a.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Pressable
              onPress={() => router.push('/following')}
              style={[styles.personalize, { borderColor: theme.border }]}>
              <Ionicons name="sparkles-outline" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{t('dashboard.personalizeTitle')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('dashboard.personalizeHint')}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </Section>

        {/* Top news */}
        <Section title={t('dashboard.topNews')} actionLabel={t('dashboard.seeAll')} onAction={() => router.push('/news')}>
          {newsLoading ? (
            <NewsListSkeleton />
          ) : (
            topNews.map((a) => <NewsCard key={a.id} article={a} onPress={() => openArticle(a.link)} />)
          )}
        </Section>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Spacing.six },
  section: { marginTop: Spacing.four },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  sectionTitle: { letterSpacing: 0.5 },
  hero: {
    margin: Spacing.three,
    marginBottom: 0,
    padding: Spacing.four,
    borderRadius: 16,
    gap: Spacing.one,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.one },
  heroName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    margin: Spacing.three,
    marginBottom: 0,
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  promptIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  followBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBadgeText: { fontSize: 10, fontWeight: '800' },
  favRow: { gap: Spacing.two, paddingHorizontal: Spacing.three },
  favChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    maxWidth: 200,
  },
  favFlag: { fontSize: 18 },
  favName: { flexShrink: 1 },
  personalize: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
});
