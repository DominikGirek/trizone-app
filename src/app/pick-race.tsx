import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeriesTag } from '@/components/SeriesTag';
import { EmptyState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';
import { countryFlag, formatDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import type { AppLanguage } from '@/i18n';
import { getAllEvents, type FeedItem } from '@/services/events';
import { useMyRaces, type MyRace } from '@/store/myRaces';

const nameOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.name : i.event.name);
const placeOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.location : i.event.town);
const ctryOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.country : i.event.country);

export default function PickRaceScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { coords } = useLocation();
  const { isRacing, isMain, toggle, setMain } = useMyRaces();
  const [query, setQuery] = useState('');

  const { data: feed } = useQuery({
    queryKey: ['allEvents', coords?.lat, coords?.lon],
    queryFn: () => getAllEvents(coords),
  });

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    // Branded (pro/series) first so it wins when we dedupe same race + day.
    const ordered = [...(feed ?? [])]
      .filter((i) => i.status !== 'finished')
      .sort((a, b) => (a.kind === 'local' ? 1 : 0) - (b.kind === 'local' ? 1 : 0));
    const seen = new Set<string>();
    const deduped = ordered.filter((i) => {
      const key = `${nameOf(i).toLowerCase().replace(/\s+/g, ' ').trim()}|${i.date.slice(0, 10)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const matched = q
      ? deduped.filter((i) => `${nameOf(i)} ${placeOf(i) ?? ''} ${ctryOf(i) ?? ''}`.toLowerCase().includes(q))
      : deduped;
    return matched.slice(0, 60);
  }, [feed, q]);

  const pick = (i: FeedItem) => {
    const race: MyRace = {
      id: i.id,
      kind: i.kind === 'pro' ? 'pro' : 'local',
      name: nameOf(i),
      date: i.date,
      location: placeOf(i),
      country: ctryOf(i),
    };
    if (!isRacing(i.id)) toggle(race);
    if (!isMain(i.id)) setMain(i.id);
    haptics.success();
    router.back();
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.head}>
        <ThemedText type="smallBold" style={styles.title} numberOfLines={2}>
          {t('dashboard.askTitle')}
        </ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        {t('myRaces.pickHint')}
      </ThemedText>

      <View style={[styles.inputWrap, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('myRaces.pickSearch')}
          placeholderTextColor={theme.textSecondary}
          autoFocus
          returnKeyType="search"
          style={[styles.input, { color: theme.text }]}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {results.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.noResults}>
            {t('search.empty')}
          </ThemedText>
        )}
        {results.map((i) => (
          <Pressable
            key={`${i.kind}-${i.id}`}
            onPress={() => pick(i)}
            style={({ pressed }) => [
              styles.row,
              { borderColor: theme.border },
              pressed && { backgroundColor: theme.backgroundElement },
            ]}>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {nameOf(i)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {countryFlag(ctryOf(i))} {placeOf(i)} · {formatDate(i.date, lang)}
              </ThemedText>
            </View>
            {i.kind === 'pro' && i.race.series ? (
              <SeriesTag series={i.race.series} />
            ) : i.kind !== 'pro' && i.event.series ? (
              <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800', fontSize: 11 }}>
                {i.event.series}
              </ThemedText>
            ) : null}
            <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
          </Pressable>
        ))}

        <Pressable
          onPress={() => router.push({ pathname: '/report', params: { type: 'race', prefill: query.trim() } })}
          style={[styles.notFound, { borderColor: theme.border }]}>
          <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold">{t('myRaces.notFoundTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('myRaces.notFoundHint')}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>

        <View style={{ height: insets.bottom + Spacing.five }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  title: { flex: 1, fontSize: 18 },
  hint: { paddingHorizontal: Spacing.three, paddingTop: Spacing.one, paddingBottom: Spacing.three },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: 12,
    marginBottom: Spacing.two,
  },
  input: { flex: 1, fontSize: 16, padding: 0 },
  noResults: { textAlign: 'center', paddingTop: Spacing.four },
  notFound: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
