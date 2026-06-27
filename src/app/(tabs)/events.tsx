import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Countdown } from '@/components/Countdown';
import { ReportNotFound } from '@/components/ReportNotFound';
import { SeriesTag } from '@/components/SeriesTag';
import { ListSkeleton } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { EmptyState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBar } from '@/components/TopBar';
import { Spacing } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { continentOf, countryFlag, formatDate, formatKm, monthShort, type ContinentCode } from '@/lib/format';
import { cleanRaceName, isCancelledName, newsSaysCancelled } from '@/lib/newsTopics';
import { getAllEvents, type FeedItem } from '@/services/events';
import { fetchNews } from '@/services/news';
import type { Article } from '@/types';

type Filter = 'all' | 'near' | 'past' | 'series' | 'pro';

// Rendered sequence: a day-header divides each calendar day in the chronological modes,
// while "near" stays a flat distance-ordered list (each row then carries its own date).
type ListEntry =
  | { type: 'header'; key: string; date: string }
  | { type: 'row'; key: string; item: FeedItem; showDate: boolean };

const SERIES_FINDERS = [
  { label: 'IRONMAN', url: 'https://www.ironman.com/races' },
  { label: 'Challenge', url: 'https://challengefamily.com/races/' },
  { label: 'T100', url: 'https://t100triathlon.com/' },
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? theme.primary : theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={{ color: active ? theme.onPrimary : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function FilterRow<T extends string | number>({
  allLabel,
  options,
  value,
  onChange,
  render,
}: {
  allLabel: string;
  options: T[];
  value: T | null;
  onChange: (v: T | null) => void;
  render: (v: T) => string;
}) {
  if (options.length < 2) return null;
  // Fixed-height wrapper reserves the row's vertical space, so the horizontal
  // ScrollView can never collapse and overlap the next row (RNW layout glitch).
  return (
    <View style={styles.facetWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.facetScroll} contentContainerStyle={styles.facetRow}>
        <Chip label={allLabel} active={value == null} onPress={() => onChange(null)} />
        {options.map((o) => (
          <Chip key={String(o)} label={render(o)} active={value === o} onPress={() => onChange(o)} />
        ))}
      </ScrollView>
    </View>
  );
}

const countryOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.country : i.event.country);
const regionOf = (i: FeedItem) => (i.kind === 'pro' ? undefined : i.event.region);
const uniq = <T,>(arr: T[]) => [...new Set(arr)];

export default function EventsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();
  const { coords } = useLocation();

  const [kind, setKind] = useState<Filter>('all');
  const [continent, setContinent] = useState<ContinentCode | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ['allEvents', coords?.lat, coords?.lon],
    queryFn: () => getAllEvents(coords),
  });
  // News powers cancellation detection in the LIST too (a race the headlines say is off shows
  // "Abgesagt" before you even open it — e.g. IRONMAN Nice — not just name-flagged ones).
  const { data: news } = useQuery({ queryKey: ['news'], queryFn: fetchNews });

  const setKindReset = (k: Filter) => {
    setKind(k);
    setContinent(null);
    setCountry(null);
    setRegion(null);
    setMonth(null);
  };

  // Cascading facets: kind → continent → country → month.
  const kindList = useMemo(() => {
    const all = items ?? [];
    if (kind === 'pro') return all.filter((i) => i.kind === 'pro');
    if (kind === 'series') return all.filter((i) => i.kind === 'series');
    if (kind === 'past') {
      // Finished events of the last 12 months, most recent first.
      const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
      return all
        .filter((i) => i.status === 'finished' && +new Date(i.date) >= cutoff)
        .sort((a, b) => +new Date(b.date) - +new Date(a.date));
    }
    if (kind === 'near')
      return all
        .filter((i): i is Extract<FeedItem, { kind: 'local' | 'series' }> => i.kind !== 'pro')
        .sort((a, b) => (a.event.distanceKm ?? 1e9) - (b.event.distanceKm ?? 1e9));
    return all;
  }, [items, kind]);

  const continents = useMemo(() => uniq(kindList.map((i) => continentOf(countryOf(i)))), [kindList]);
  const afterCont = useMemo(
    () => (continent ? kindList.filter((i) => continentOf(countryOf(i)) === continent) : kindList),
    [kindList, continent],
  );
  const countries = useMemo(() => uniq(afterCont.map(countryOf)).sort(), [afterCont]);
  const afterCountry = useMemo(
    () => (country ? afterCont.filter((i) => countryOf(i) === country) : afterCont),
    [afterCont, country],
  );
  // Bundesland (German state) — only meaningful once Germany is picked.
  const regions = useMemo(
    () =>
      country === 'DE'
        ? (uniq(afterCountry.map(regionOf).filter(Boolean)) as string[]).sort((a, b) => a.localeCompare(b))
        : [],
    [afterCountry, country],
  );
  const afterRegion = useMemo(
    () => (region ? afterCountry.filter((i) => regionOf(i) === region) : afterCountry),
    [afterCountry, region],
  );
  const months = useMemo(
    () => uniq(afterRegion.map((i) => new Date(i.date).getMonth())).sort((a, b) => a - b),
    [afterRegion],
  );
  const list = useMemo(
    () => (month != null ? afterRegion.filter((i) => new Date(i.date).getMonth() === month) : afterRegion),
    [afterRegion, month],
  );

  const activeCount = (continent ? 1 : 0) + (country ? 1 : 0) + (region ? 1 : 0) + (month != null ? 1 : 0);

  // The next big upcoming race (series or pro) → the "highlight" hero on the default view.
  const nextBig = useMemo(() => {
    const now = Date.now();
    return (items ?? [])
      .filter((i) => (i.kind === 'series' || i.kind === 'pro') && i.status !== 'finished' && +new Date(i.date) >= now)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0];
  }, [items]);

  const data = useMemo<ListEntry[]>(() => {
    // "Near" is sorted by distance, not date → no day headers; the row shows its own date.
    if (kind === 'near')
      return list.map((i) => ({ type: 'row', key: `${i.kind}-${i.id}`, item: i, showDate: true }));
    const out: ListEntry[] = [];
    let lastDay = '';
    for (const i of list) {
      const day = new Date(i.date).toDateString();
      if (day !== lastDay) {
        out.push({ type: 'header', key: `h-${day}`, date: i.date });
        lastDay = day;
      }
      out.push({ type: 'row', key: `${i.kind}-${i.id}`, item: i, showDate: false });
    }
    return out;
  }, [list, kind]);

  const open = (item: FeedItem) =>
    router.push(`/race/${item.id}?kind=${item.kind === 'pro' ? 'pro' : 'local'}`);

  const finderHeader =
    kind === 'series' ? (
      <View style={styles.finders}>
        {SERIES_FINDERS.map((s) => (
          <Pressable
            key={s.label}
            onPress={() => WebBrowser.openBrowserAsync(s.url)}
            style={({ pressed }) => [
              styles.finder,
              { borderColor: theme.border },
              pressed && { backgroundColor: theme.backgroundElement },
            ]}>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">{t('events.officialFinder', { series: s.label })}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                {t('events.officialNote')}
              </ThemedText>
            </View>
            <Ionicons name="open-outline" size={18} color={theme.primary} />
          </Pressable>
        ))}
      </View>
    ) : null;

  // Hero highlight on the clean default view (no filters drilled in).
  const listHeader = (
    <>
      {kind === 'all' && activeCount === 0 && nextBig ? (
        <HighlightCard item={nextBig} onPress={() => open(nextBig)} />
      ) : null}
      {finderHeader}
    </>
  );

  return (
    <ThemedView style={styles.container}>
      <TopBar title={t('tabs.events')} />

      <View style={styles.facetWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.facetScroll} contentContainerStyle={styles.facetRow}>
          {(['all', 'near', 'past', 'series', 'pro'] as Filter[]).map((f) => (
            <Chip key={f} label={t(`events.${f}`)} active={kind === f} onPress={() => setKindReset(f)} />
          ))}
        </ScrollView>
      </View>

      {/* Slim filter bar: one tap to reveal the facets, with active filters shown as
          removable chips so nothing is hidden — keeps the default view uncluttered. */}
      <View style={styles.filterBar}>
        <Pressable
          onPress={() => setShowFilters((s) => !s)}
          style={({ pressed }) => [
            styles.filterToggle,
            { backgroundColor: activeCount ? theme.primary : theme.backgroundElement },
            pressed && { opacity: 0.7 },
          ]}>
          <Ionicons name="options-outline" size={15} color={activeCount ? theme.onPrimary : theme.textSecondary} />
          <ThemedText type="smallBold" style={{ color: activeCount ? theme.onPrimary : theme.textSecondary }}>
            {t('events.filter')}
            {activeCount ? ` · ${activeCount}` : ''}
          </ThemedText>
          <Ionicons
            name={showFilters ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={activeCount ? theme.onPrimary : theme.textSecondary}
          />
        </Pressable>
        {!showFilters && activeCount > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeRow}>
            {continent && <ActiveChip label={t(`continent.${continent}`)} onClear={() => setContinent(null)} />}
            {country && (
              <ActiveChip
                label={`${countryFlag(country)} ${country}`}
                onClear={() => {
                  setCountry(null);
                  setRegion(null);
                }}
              />
            )}
            {region && <ActiveChip label={region} onClear={() => setRegion(null)} />}
            {month != null && <ActiveChip label={monthShort(month, lang)} onClear={() => setMonth(null)} />}
          </ScrollView>
        )}
      </View>

      {showFilters && (
        <View>
          <FilterRow
            allLabel={t('events.continent')}
            options={continents}
            value={continent}
            onChange={(v) => {
              setContinent(v);
              setCountry(null);
              setRegion(null);
            }}
            render={(c) => t(`continent.${c}`)}
          />
          <FilterRow
            allLabel={t('events.country')}
            options={countries}
            value={country}
            onChange={(v) => {
              setCountry(v);
              setRegion(null);
            }}
            render={(c) => `${countryFlag(c)} ${c}`}
          />
          <FilterRow allLabel={t('events.region')} options={regions} value={region} onChange={setRegion} render={(r) => r} />
          <FilterRow
            allLabel={t('events.month')}
            options={months}
            value={month}
            onChange={setMonth}
            render={(m) => monthShort(m, lang)}
          />
        </View>
      )}

      {isLoading ? (
        <ListSkeleton count={8} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(e) => e.key}
          ListHeaderComponent={listHeader}
          renderItem={({ item: e }) =>
            e.type === 'header' ? (
              <DayHeader date={e.date} />
            ) : (
              <EventRow item={e.item} showDate={e.showDate} news={news} onPress={() => open(e.item)} />
            )
          }
          ListEmptyComponent={<EmptyState icon="calendar-outline" message={t('events.empty')} />}
          ListFooterComponent={
            <View style={styles.listFooter}>
              <ReportNotFound type="race" />
            </View>
          }
          contentContainerStyle={data.length ? styles.listContent : styles.empty}
        />
      )}
    </ThemedView>
  );
}

function DayHeader({ date }: { date: string }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : 'en-US';
  const d = new Date(date);
  const weekday = d.toLocaleDateString(locale, { weekday: 'long' });
  const rest = d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  return (
    <View style={styles.dayHeader}>
      <View style={[styles.dayDot, { backgroundColor: theme.primary }]} />
      <ThemedText type="smallBold" style={styles.dayHeaderText}>
        {weekday}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.dayHeaderText}>
        {rest}
      </ThemedText>
    </View>
  );
}

function EventRow({
  item,
  showDate,
  news,
  onPress,
}: {
  item: FeedItem;
  showDate: boolean;
  news?: Article[];
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  const pro = item.kind === 'pro';
  const name = item.kind === 'pro' ? item.race.name : item.event.name;
  const country = item.kind === 'pro' ? item.race.country : item.event.country;
  const town = item.kind === 'pro' ? item.race.location : item.event.town;
  const status = item.kind === 'pro' ? item.race.status : item.event.status;
  const distanceKm = item.kind === 'pro' ? null : item.event.distanceKm;
  const localSeries = item.kind !== 'pro' ? item.event.series : undefined;
  const distances = item.kind !== 'pro' ? item.event.distances : undefined;
  const newsCancelled = useMemo(() => newsSaysCancelled(news ?? [], name, town), [news, name, town]);
  const cancelled = isCancelledName(name) || newsCancelled;
  const displayName = cancelled ? cleanRaceName(name) : name;
  const accent = cancelled ? theme.primary : pro || localSeries ? theme.primary : theme.border;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          {item.kind === 'pro' ? (
            <SeriesTag series={item.race.series} />
          ) : localSeries ? (
            <ThemedText type="small" style={[styles.localSeries, { color: theme.primary }]}>
              {localSeries.toUpperCase()}
            </ThemedText>
          ) : null}
          <View style={{ flex: 1 }} />
          {showDate && (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
              {formatDate(item.date, lang)}
            </ThemedText>
          )}
          {(cancelled || status === 'live') && <StatusPill status={status} cancelled={cancelled} />}
        </View>
        <ThemedText type="smallBold" numberOfLines={1} style={[styles.rowName, cancelled && styles.struck]}>
          {displayName}
        </ThemedText>
        <View style={styles.rowMeta}>
          <Ionicons name="location-outline" size={13} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
            {countryFlag(country)} {town}
            {item.kind === 'pro' ? ` · ${t(`format.${item.race.format}`)}` : ''}
          </ThemedText>
          {distanceKm != null && (
            <View style={[styles.distBadge, { backgroundColor: theme.background }]}>
              <Ionicons name="navigate" size={10} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, fontSize: 11, fontWeight: '700' }}>
                {formatKm(distanceKm)}
              </ThemedText>
            </View>
          )}
        </View>
        {distances && distances.length > 0 && (
          <View style={styles.chips}>
            {distances.slice(0, 3).map((dd) => (
              <ThemedText
                key={dd.label}
                type="small"
                themeColor="textSecondary"
                style={[styles.distChip, { borderColor: theme.border }]}>
                {dd.label}
              </ThemedText>
            ))}
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onClear} style={[styles.activeChip, { backgroundColor: theme.primary }]}>
      <ThemedText type="small" style={{ color: theme.onPrimary, fontSize: 12, fontWeight: '700' }}>
        {label}
      </ThemedText>
      <Ionicons name="close" size={13} color={theme.onPrimary} />
    </Pressable>
  );
}

function HighlightCard({ item, onPress }: { item: FeedItem; onPress: () => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const name = item.kind === 'pro' ? item.race.name : item.event.name;
  const country = item.kind === 'pro' ? item.race.country : item.event.country;
  const town = item.kind === 'pro' ? item.race.location : item.event.town;
  const series = item.kind === 'pro' ? t(`series.${item.race.series}`) : item.event.series;
  const d = new Date(item.date);
  const days = Math.ceil((+d - Date.now()) / 864e5);
  const weekend = days >= 0 && days <= 7 && (d.getDay() === 0 || d.getDay() === 6);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.hero, { backgroundColor: theme.primary }, pressed && { opacity: 0.92 }]}>
      <View style={styles.heroTopRow}>
        <ThemedText type="small" style={[styles.heroKicker, { color: theme.onPrimary }]}>
          {(weekend ? t('events.thisWeekend') : t('events.nextHighlight')).toUpperCase()}
        </ThemedText>
        {!!series && (
          <ThemedText type="small" style={[styles.heroSeries, { color: theme.onPrimary }]}>
            {series}
          </ThemedText>
        )}
      </View>
      <ThemedText type="subtitle" numberOfLines={2} style={[styles.heroName, { color: theme.onPrimary }]}>
        {name}
      </ThemedText>
      <ThemedText type="small" style={[styles.heroLoc, { color: theme.onPrimary }]}>
        {countryFlag(country)} {town} · {formatDate(item.date, lang)}
      </ThemedText>
      <View style={styles.heroCountdown}>
        <Countdown date={item.date} color={theme.onPrimary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listFooter: { paddingBottom: Spacing.six },
  kindRow: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  facetWrap: { height: 38, marginBottom: Spacing.two, overflow: 'hidden' },
  facetScroll: { flexGrow: 0, height: 38 },
  facetRow: { gap: Spacing.two, paddingHorizontal: Spacing.three, alignItems: 'center' },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: 999 },
  finders: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two },
  finder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  listContent: { paddingBottom: Spacing.two },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, marginBottom: Spacing.two },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
  },
  activeRow: { gap: Spacing.two, alignItems: 'center', paddingRight: Spacing.three },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: Spacing.two + 2,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  hero: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
    padding: Spacing.four,
    borderRadius: 18,
    gap: 4,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroSeries: { fontSize: 11, fontWeight: '800', opacity: 0.9 },
  heroName: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  heroLoc: { fontSize: 13, opacity: 0.92 },
  heroCountdown: { marginTop: Spacing.two },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one + 2,
  },
  dayDot: { width: 6, height: 6, borderRadius: 3 },
  dayHeaderText: { fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
    paddingRight: Spacing.three,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    overflow: 'hidden',
  },
  accent: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  rowBody: { flex: 1, gap: 3, paddingVertical: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 18 },
  localSeries: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  rowName: { fontSize: 15 },
  struck: { textDecorationLine: 'line-through', opacity: 0.6 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 999,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  distChip: {
    fontSize: 11,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: { flexGrow: 1 },
});
