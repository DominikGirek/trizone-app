import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Countdown } from '@/components/Countdown';
import { LocalEventCard } from '@/components/LocalEventCard';
import { HotNewsBanner } from '@/components/HotNewsBanner';
import { NewsCard } from '@/components/NewsCard';
import { Pill } from '@/components/Pill';
import { SeriesTag } from '@/components/SeriesTag';
import { NewsListSkeleton } from '@/components/Skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HeaderIconButton, Wordmark } from '@/components/TopBar';
import { Spacing } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { fameScore } from '@/lib/athleteFame';
import { athleteTitle } from '@/lib/athleteTitle';
import { avatarColor, initials } from '@/lib/avatar';
import { countryFlag, formatDate, formatKm, timeAgo } from '@/lib/format';
import { hotAlerts } from '@/lib/hotNews';
import { useHotNewsRead } from '@/store/hotNewsRead';
import { mentionsAny, pickForYou } from '@/lib/newsTopics';
import { getAthletesByIds } from '@/services/athletes';
import { getAllEvents, type FeedItem } from '@/services/events';
import { fetchNews } from '@/services/news';
import { getRaceStartList, raceKey } from '@/services/races';
import { useFavorites } from '@/store/favorites';
import { useMyRaces } from '@/store/myRaces';

const dateOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.date : i.event.date);
const statusOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.status : i.event.status);
const nameOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.name : i.event.name);
const placeOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.location : i.event.town);
const ctryOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.country : i.event.country);
const distOf = (i: FeedItem) => (i.kind === 'pro' ? undefined : i.event.distanceKm);

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// A followed athlete with a result/win in a fresh headline → red "athlete moment".
const RESULT_RE = /\b(gewinnt|siegt|sieg|sieger|weltmeister|holt|triumph|champion|wins?|victory|podium|titel|rekord)\b/i;

type FeedTab = 'foryou' | 'news' | 'races' | 'athletes';

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

/** Horizontal "story" shortcut — a smart, personalised entry point (OneFootball-style). */
function ShortcutCard({
  emoji,
  title,
  subtitle,
  accent,
  onPress,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  accent?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.shortcut,
        { backgroundColor: accent ? theme.primary : theme.backgroundElement, borderColor: accent ? theme.primary : theme.border },
        pressed && { opacity: 0.85 },
      ]}>
      <View style={[styles.shortcutEmoji, { backgroundColor: accent ? 'rgba(255,255,255,0.22)' : theme.background }]}>
        <ThemedText style={{ fontSize: 17 }}>{emoji}</ThemedText>
      </View>
      <ThemedText type="smallBold" numberOfLines={1} style={[styles.shortcutTitle, accent && { color: theme.onPrimary }]}>
        {title}
      </ThemedText>
      {!!subtitle && (
        <ThemedText type="small" numberOfLines={1} style={{ fontSize: 11, color: accent ? 'rgba(255,255,255,0.85)' : theme.textSecondary }}>
          {subtitle}
        </ThemedText>
      )}
    </Pressable>
  );
}

/** Feed filter pill. Active = outlined (OneFootball look). */
function FeedChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? { borderColor: theme.text, borderWidth: 1.5 } : { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={{ color: active ? theme.text : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const locale = lang === 'de' ? 'de-DE' : 'en-US';
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [feed, setFeed] = useState<FeedTab>('foryou');
  const [hotExpanded, setHotExpanded] = useState(false);
  const { coords } = useLocation();
  const { idsOf } = useFavorites();
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
    const inTitle = (title: string, term: string) =>
      new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(title);
    for (const a of news ?? []) {
      if (+new Date(a.publishedAt) < cutoff || !RESULT_RE.test(a.title)) continue;
      const name = athleteNames.find((n) => {
        const last = n.split(/\s+/).pop()!;
        return inTitle(a.title, n) || (last.length > 3 && inTitle(a.title, last));
      });
      if (name) return { article: a, name };
    }
    return null;
  }, [relevantLive, news, athleteNames]);

  const nextDays = myNext ? Math.ceil((+new Date(myNext.date) - Date.now()) / 86400000) : null;
  const raceWeek = !!myNext && nextDays != null && nextDays >= 0 && nextDays <= 7;

  // Next big race (series or pro) → the "matchday" highlight card.
  const nextBig = useMemo(() => {
    const now = Date.now();
    return all
      .filter((i) => (i.kind === 'series' || i.kind === 'pro') && statusOf(i) !== 'finished' && +new Date(dateOf(i)) >= now)
      .sort((a, b) => +new Date(dateOf(a)) - +new Date(dateOf(b)))[0];
  }, [all]);
  const showMatch = !!nextBig && nextBig.id !== myNext?.id;
  const matchKey = showMatch ? raceKey(nameOf(nextBig), dateOf(nextBig)) : '';
  const { data: matchList } = useQuery({
    queryKey: ['startlist', matchKey],
    queryFn: () => getRaceStartList(matchKey),
    enabled: !!matchKey,
  });
  // Lead with the best-known names (not alphabetical) so the avatars are recognisable.
  const matchStarters = useMemo(
    () =>
      [...(matchList?.entries ?? [])].sort(
        (a, b) => fameScore(b.athlete) - fameScore(a.athlete) || a.athlete.name.localeCompare(b.athlete.name),
      ),
    [matchList],
  );

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
  const [sessionSeed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const newsBucket = Math.floor(Date.now() / (30 * 60 * 1000));
  const topNews = useMemo(() => {
    const arr = news ?? [];
    let list = arr.filter((a) => a.lang === uiLang);
    if (!list.length) list = arr;
    if (!list.length) return [];
    const lead = [...list].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))[0];
    const rest = pickForYou(
      list.filter((a) => a.id !== lead.id),
      { athleteNames, seriesIds, brandIds },
      sessionSeed + newsBucket,
      2,
    );
    return [lead, ...rest];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news, uiLang, athleteNames.join('|'), seriesIds.join('|'), brandIds.join('|'), sessionSeed, newsBucket]);

  // The switchable bottom feed — one news list per chip.
  const recentNews = useMemo(() => {
    const arr = (news ?? []).filter((a) => a.lang === uiLang);
    return [...(arr.length ? arr : (news ?? []))]
      .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
      .slice(0, 14);
  }, [news, uiLang]);
  const athleteNewsList = useMemo(() => {
    const toks = athleteNames.flatMap((n) => [n, n.split(/\s+/).pop() ?? '']).filter((tk) => tk.length >= 4);
    return toks.length ? (news ?? []).filter((a) => mentionsAny(`${a.title} ${a.summary}`, toks)).slice(0, 12) : [];
  }, [news, athleteNames]);
  const raceNewsList = useMemo(() => {
    const toks = myRaces.flatMap((r) => r.name.split(/[^\p{L}\p{N}]+/u)).filter((w) => w.length >= 4);
    return toks.length ? (news ?? []).filter((a) => mentionsAny(`${a.title} ${a.summary}`, toks)).slice(0, 12) : [];
  }, [news, myRaces]);
  const feedNews =
    feed === 'news' ? recentNews : feed === 'athletes' ? athleteNewsList : feed === 'races' ? raceNewsList : topNews;

  const openArticle = (link: string) => link && WebBrowser.openBrowserAsync(link);
  // — Hot news: time-critical changes (cancel/shorten/postpone) to upcoming races. Stage-1, in-app
  //   preview of what a push would later say. High-precision: race + impact word in the headline.
  const hotList = useMemo(() => {
    const now = Date.now();
    const horizon = now + 21 * 24 * 60 * 60 * 1000;
    const refs = (events ?? [])
      .filter((i) => {
        const status = i.kind === 'pro' ? i.race.status : i.event.status;
        return (status === 'upcoming' || status === 'live') && +new Date(i.date) <= horizon;
      })
      .map((i) => ({ id: i.id, name: nameOf(i), place: placeOf(i), item: i }));
    return hotAlerts(news ?? [], refs, now).slice(0, 3);
  }, [events, news]);

  // Hide the ones the user marked read; key by race+category so an escalation re-surfaces.
  const { isRead, markRead } = useHotNewsRead();
  const hotKey = (h: (typeof hotList)[number]) => `${h.race.id}:${h.category}`;
  const visibleHot = hotList.filter((h) => !isRead(hotKey(h)));

  const openItem = (i: FeedItem) =>
    i.kind === 'pro' ? router.push(`/event/${i.id}`) : router.push(`/local/${i.id}`);
  const openMyNext = () =>
    myNext && (myNext.kind === 'pro' ? router.push(`/event/${myNext.id}`) : router.push(`/local/${myNext.id}`));

  // Shared red hero card for a race countdown — now with a faint sport glyph for depth.
  const renderRaceHero = (pillLabel: string) =>
    myNext && (
      <Pressable
        onPress={openMyNext}
        style={({ pressed }) => [styles.hero, styles.heroNeutral, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }, pressed && { opacity: 0.85 }]}>
        <Ionicons name="walk" size={150} color={theme.border} style={styles.heroGlyph} />
        <View style={styles.heroTop}>
          <Pill label={pillLabel} color={theme.textSecondary} background={theme.background} />
          <ThemedText type="small" themeColor="textSecondary">
            {countryFlag(myNext.country ?? 'DE')} {myNext.location}
          </ThemedText>
        </View>
        <ThemedText style={styles.heroName} numberOfLines={2}>
          {myNext.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.two }}>
          {formatDate(myNext.date, lang)}
        </ThemedText>
        <Countdown date={myNext.date} color={theme.text} />
      </Pressable>
    );

  // Smart, personalised story-shortcuts (adapt to your race / live state).
  const shortcuts: { emoji: string; title: string; subtitle?: string; accent?: boolean; onPress: () => void }[] = [
    myNext
      ? {
          emoji: '🏁',
          title: t('quick.myRaces'),
          subtitle: nextDays != null && nextDays >= 0 ? t('dashboard.inDays', { count: nextDays }) : myNext.location,
          onPress: openMyNext,
        }
      : { emoji: '🏁', title: t('dashboard.pickRace'), subtitle: t('dashboard.pickRaceSub'), onPress: () => router.push('/pick-race') },
    relevantLive
      ? { emoji: '🔴', title: t('dashboard.liveNow'), subtitle: placeOf(relevantLive), accent: true, onPress: () => openItem(relevantLive) }
      : { emoji: '📅', title: t('quick.races'), subtitle: t('dashboard.calendarSub'), onPress: () => router.push('/events') },
    ...(showMatch ? [{ emoji: '⭐', title: t('dashboard.proStartersShort'), subtitle: nameOf(nextBig), onPress: () => openItem(nextBig) }] : []),
    { emoji: '🏆', title: t('quick.ranking'), subtitle: 'WTCS', onPress: () => router.push('/standings') },
    { emoji: '🎟️', title: t('tabs.deals'), subtitle: t('dashboard.codesSub'), onPress: () => router.push('/deals') },
  ];

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, borderColor: theme.border }]}>
        <Pressable
          onPress={() => router.push('/following')}
          accessibilityRole="button"
          accessibilityLabel={t('following.title')}
          style={({ pressed }) => [styles.avatar, { backgroundColor: theme.backgroundElement, borderColor: theme.primary }, pressed && { opacity: 0.7 }]}>
          <Ionicons name="person" size={18} color={theme.text} />
        </Pressable>
        <Wordmark size={22} />
        <View style={{ flex: 1 }} />
        <HeaderIconButton icon="search" onPress={() => router.push('/search')} label={t('search.placeholder')} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hot news — urgent race-status changes for upcoming races (preview of a future push). */}
        {visibleHot.length > 0 && (
          <View style={styles.hotStack}>
            {(hotExpanded ? visibleHot : visibleHot.slice(0, 1)).map((h) => (
              <HotNewsBanner
                key={hotKey(h)}
                alert={h}
                raceName={h.race.name}
                onPress={() => openItem(h.race.item)}
                onDismiss={() => markRead(hotKey(h))}
              />
            ))}
            {visibleHot.length > 1 && (
              <Pressable
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setHotExpanded((v) => !v);
                }}
                style={({ pressed }) => [
                  styles.hotMore,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && { opacity: 0.7 },
                ]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {hotExpanded ? t('dashboard.lessAlerts') : t('dashboard.moreAlerts', { count: visibleHot.length - 1 })}
                </ThemedText>
                <Ionicons name={hotExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>
        )}

        {/* Smart hero — one prominent tile, red for the urgent states. */}
        {relevantLive ? (
          <Pressable
            onPress={() =>
              relevantLive.kind !== 'pro' && relevantLive.event.raceresultEventId
                ? router.push(`/live/${relevantLive.event.raceresultEventId}`)
                : openItem(relevantLive)
            }
            style={({ pressed }) => [styles.hero, { backgroundColor: theme.primary }, pressed && { opacity: 0.9 }]}>
            <Ionicons name="radio" size={150} color="rgba(255,255,255,0.13)" style={styles.heroGlyph} />
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
            onPress={() => openArticle(athleteMoment.article.link)}
            style={({ pressed }) => [styles.hero, styles.heroNeutral, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }, pressed && { opacity: 0.85 }]}>
            <Ionicons name="trophy" size={150} color={theme.border} style={styles.heroGlyph} />
            <View style={styles.heroTop}>
              <Pill label={athleteMoment.name} color={theme.textSecondary} background={theme.background} />
              <Ionicons name="trophy-outline" size={20} color={theme.textSecondary} />
            </View>
            <ThemedText style={[styles.heroName, { fontSize: 19 }]} numberOfLines={3}>
              {athleteMoment.article.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {athleteMoment.article.source} · {timeAgo(athleteMoment.article.publishedAt, lang)}
            </ThemedText>
          </Pressable>
        ) : myNext ? (
          renderRaceHero(isMain(myNext.id) ? t('dashboard.mainRace') : t('dashboard.myRace'))
        ) : (
          <Pressable
            onPress={() => router.push('/pick-race')}
            style={({ pressed }) => [
              styles.prompt,
              { borderColor: theme.border, backgroundColor: theme.backgroundSelected },
              pressed && { opacity: 0.85 },
            ]}>
            <View style={[styles.promptIcon, { backgroundColor: theme.background }]}>
              <Ionicons name="flag" size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" style={{ fontSize: 16 }}>
                {t('dashboard.askTitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('dashboard.askSubtitle')}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </Pressable>
        )}

        {/* Smart shortcut cards (horizontal, personalised) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutRow}>
          {shortcuts.map((s) => (
            <ShortcutCard key={s.title} emoji={s.emoji} title={s.title} subtitle={s.subtitle} accent={s.accent} onPress={s.onPress} />
          ))}
        </ScrollView>

        {/* Feed filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {(
            [
              ['foryou', t('dashboard.feedForYou')],
              ['news', t('dashboard.feedTopNews')],
              ['races', t('dashboard.feedMyRaces')],
              ['athletes', t('dashboard.feedAthletes')],
            ] as [FeedTab, string][]
          ).map(([id, label]) => (
            <FeedChip key={id} label={label} active={feed === id} onPress={() => setFeed(id)} />
          ))}
        </ScrollView>

        {/* Next highlight — matchday card */}
        {(feed === 'foryou' || feed === 'races') && showMatch && (
          <Section title={t('dashboard.nextHighlight')} actionLabel={t('dashboard.seeAll')} onAction={() => router.push('/events')}>
            <Pressable
              onPress={() => openItem(nextBig)}
              style={({ pressed }) => [
                styles.matchCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                pressed && { opacity: 0.85 },
              ]}>
              <View style={styles.matchTop}>
                {nextBig.kind === 'pro' ? (
                  <SeriesTag series={nextBig.race.series} />
                ) : nextBig.event.series ? (
                  <ThemedText type="small" style={[styles.matchSeries, { color: theme.primary }]}>
                    {nextBig.event.series.toUpperCase()}
                  </ThemedText>
                ) : (
                  <View />
                )}
                <ThemedText type="small" themeColor="textSecondary">
                  {new Date(dateOf(nextBig)).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' })}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" style={styles.matchName} numberOfLines={2}>
                {nameOf(nextBig)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 1 }}>
                {countryFlag(ctryOf(nextBig))} {placeOf(nextBig)}
              </ThemedText>

              {nextBig.kind !== 'pro' &&
                (() => {
                  const d0 = nextBig.event.distances?.[0];
                  const legs = [d0?.swim, d0?.bike, d0?.run].filter((km): km is number => typeof km === 'number');
                  return legs.length ? (
                    <View style={styles.chips}>
                      {legs.map((km, idx) => (
                        <View key={idx} style={[styles.distChip, { borderColor: theme.border }]}>
                          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                            {formatKm(km)}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  ) : null;
                })()}

              {matchStarters.length > 0 && (
                <View style={[styles.startersWrap, { borderColor: theme.border }]}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.startersLabel}>
                    {t('dashboard.proStarters', { count: matchStarters.length }).toUpperCase()}
                  </ThemedText>
                  <View style={styles.starterRow}>
                    {matchStarters.slice(0, 4).map((e) => (
                      <View key={e.athlete.id} style={styles.starter}>
                        <View style={[styles.miniAvatar, { backgroundColor: avatarColor(e.athlete.name) }]}>
                          <ThemedText style={styles.miniAvatarText}>{initials(e.athlete.name)}</ThemedText>
                        </View>
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.starterName}>
                          {e.athlete.name.split(/\s+/).pop()}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </Pressable>
          </Section>
        )}

        {/* Near you */}
        {(feed === 'foryou' || feed === 'races') && nearby.length > 0 && (
          <Section title={t('local.nearby')} actionLabel={t('dashboard.seeAll')} onAction={() => router.push('/events')}>
            {nearby.map((i) => (
              <LocalEventCard key={i.id} event={i.event} onPress={() => openItem(i)} />
            ))}
          </Section>
        )}

        {/* Your stars */}
        {(feed === 'foryou' || feed === 'athletes') && (
          <Section
            title={t('dashboard.yourStars')}
            actionLabel={athleteIds.length ? t('dashboard.seeAll') : undefined}
            onAction={athleteIds.length ? () => router.push('/favorites') : undefined}>
          {athleteIds.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.starsRow}>
              {(favAthletes ?? []).map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => router.push(`/athlete/${a.id}`)}
                  style={({ pressed }) => [
                    styles.starCard,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    pressed && { opacity: 0.8 },
                  ]}>
                  <View style={[styles.starAvatar, { backgroundColor: avatarColor(a.name) }]}>
                    <ThemedText style={styles.starAvatarText}>{initials(a.name)}</ThemedText>
                  </View>
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.starName}>
                    {a.name}
                  </ThemedText>
                  <ThemedText type="small" numberOfLines={1} style={[styles.starTitle, { color: theme.primary }]}>
                    {athleteTitle(a)}
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
        )}

        {/* Switchable news feed (driven by the chips) */}
        <Section
          title={
            feed === 'news'
              ? t('dashboard.feedTopNews')
              : feed === 'athletes'
                ? t('dashboard.feedAthletes')
                : feed === 'races'
                  ? t('dashboard.feedMyRaces')
                  : t('dashboard.topNews')
          }
          actionLabel={t('dashboard.seeAll')}
          onAction={() => router.push('/news')}>
          {newsLoading ? (
            <NewsListSkeleton />
          ) : feedNews.length > 0 ? (
            feedNews.map((a) => <NewsCard key={a.id} article={a} onPress={() => openArticle(a.link)} />)
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.feedEmpty}>
              {t('dashboard.feedEmpty')}
            </ThemedText>
          )}
        </Section>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Spacing.six },
  hotStack: { marginHorizontal: Spacing.three, marginTop: Spacing.three, gap: Spacing.two },
  hotMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  shortcutRow: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  shortcut: { width: 134, padding: Spacing.three, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 5 },
  shortcutEmoji: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  shortcutTitle: { fontSize: 13 },
  chipRow: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: 999 },
  feedEmpty: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
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
    overflow: 'hidden',
  },
  heroNeutral: { borderWidth: StyleSheet.hairlineWidth },
  heroGlyph: { position: 'absolute', right: -14, bottom: -18 },
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
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.three,
  },
  quickTile: { alignItems: 'center', width: 72 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, marginTop: 6, textAlign: 'center' },
  matchCard: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  matchTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20 },
  matchSeries: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  matchName: { fontSize: 16, marginTop: 6 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 9 },
  distChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  startersWrap: { marginTop: Spacing.three, paddingTop: Spacing.two + 2, borderTopWidth: StyleSheet.hairlineWidth },
  startersLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: Spacing.two },
  starterRow: { flexDirection: 'row', gap: Spacing.three },
  starter: { alignItems: 'center', width: 52 },
  miniAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  starterName: { fontSize: 10, marginTop: 4 },
  starsRow: { gap: Spacing.two, paddingHorizontal: Spacing.three },
  starCard: {
    width: 132,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  starAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  starAvatarText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  starName: { fontSize: 13, marginTop: 9 },
  starTitle: { fontSize: 11, fontWeight: '800', marginTop: 2 },
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
