import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LocalEventCard } from '@/components/LocalEventCard';
import { RaceCard } from '@/components/RaceCard';
import { ReportNotFound } from '@/components/ReportNotFound';
import { SeriesTag } from '@/components/SeriesTag';
import { ListSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBar } from '@/components/TopBar';
import { Spacing } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { continentOf, countryFlag, formatDate, monthShort, type ContinentCode } from '@/lib/format';
import { getAllEvents, type FeedItem } from '@/services/events';
import { getStartListIndex } from '@/services/races';

type Filter = 'all' | 'near' | 'past' | 'series' | 'pro';

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
const uniq = <T,>(arr: T[]) => [...new Set(arr)];

export default function EventsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();
  const { coords } = useLocation();

  const [kind, setKind] = useState<Filter>('all');
  const [continent, setContinent] = useState<ContinentCode | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [month, setMonth] = useState<number | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ['allEvents', coords?.lat, coords?.lon],
    queryFn: () => getAllEvents(coords),
  });
  const { data: startLists = [] } = useQuery({
    queryKey: ['startlist-index'],
    queryFn: () => getStartListIndex(),
  });

  const setKindReset = (k: Filter) => {
    setKind(k);
    setContinent(null);
    setCountry(null);
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
  const months = useMemo(
    () => uniq(afterCountry.map((i) => new Date(i.date).getMonth())).sort((a, b) => a - b),
    [afterCountry],
  );
  const list = useMemo(
    () => (month != null ? afterCountry.filter((i) => new Date(i.date).getMonth() === month) : afterCountry),
    [afterCountry, month],
  );

  const open = (item: FeedItem) =>
    item.kind === 'pro' ? router.push(`/event/${item.id}`) : router.push(`/local/${item.id}`);

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

  const listHeader = (
    <>
      {(kind === 'all' || kind === 'pro') && startLists.length > 0 && (
        <View style={styles.finders}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.startlistTitle}>
            {t('startlist.title').toUpperCase()}
          </ThemedText>
          {startLists.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => router.push(`/startlist/${r.key}`)}
              style={({ pressed }) => [
                styles.finder,
                { borderColor: theme.border },
                pressed && { backgroundColor: theme.backgroundElement },
              ]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {r.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                  {formatDate(r.date, lang)} · {t('startlist.count', { count: r.count })}
                </ThemedText>
              </View>
              {r.series && <SeriesTag series={r.series} />}
              <Ionicons name="chevron-forward" size={18} color={theme.primary} />
            </Pressable>
          ))}
        </View>
      )}
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

      <FilterRow
        allLabel={`🌍 ${t('events.continent')}`}
        options={continents}
        value={continent}
        onChange={(v) => {
          setContinent(v);
          setCountry(null);
        }}
        render={(c) => t(`continent.${c}`)}
      />
      <FilterRow
        allLabel={`🏳️ ${t('events.country')}`}
        options={countries}
        value={country}
        onChange={setCountry}
        render={(c) => `${countryFlag(c)} ${c}`}
      />
      <FilterRow
        allLabel={`📅 ${t('events.month')}`}
        options={months}
        value={month}
        onChange={setMonth}
        render={(m) => monthShort(m, lang)}
      />

      {isLoading ? (
        <ListSkeleton count={8} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) =>
            item.kind === 'pro' ? (
              <RaceCard race={item.race} onPress={() => open(item)} />
            ) : (
              <LocalEventCard event={item.event} onPress={() => open(item)} />
            )
          }
          ListEmptyComponent={<EmptyState icon="calendar-outline" message={t('events.empty')} />}
          ListFooterComponent={
            <View style={styles.listFooter}>
              <ReportNotFound type="race" />
            </View>
          }
          contentContainerStyle={list.length ? undefined : styles.empty}
        />
      )}
    </ThemedView>
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
  startlistTitle: { letterSpacing: 0.4, marginTop: Spacing.one },
  finder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  empty: { flexGrow: 1 },
});
