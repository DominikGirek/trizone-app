import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FavoriteButton } from '@/components/FavoriteButton';
import { ReportNotFound } from '@/components/ReportNotFound';
import { SeriesTag } from '@/components/SeriesTag';
import { EmptyState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';
import { fameScore } from '@/lib/athleteFame';
import { countryFlag, fold } from '@/lib/format';
import { bundledAthletes, getAthletes } from '@/services/athletes';
import { getAllEvents, type FeedItem } from '@/services/events';

const nameOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.name : i.event.name);
const placeOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.location : i.event.town);
const ctryOf = (i: FeedItem) => (i.kind === 'pro' ? i.race.country : i.event.country);

export default function SearchScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const { coords } = useLocation();
  const { data: feed } = useQuery({
    queryKey: ['allEvents', coords?.lat, coords?.lon],
    queryFn: () => getAllEvents(coords),
  });
  // The FULL roster (curated + every generated pro from the start-list sources), so search
  // finds athletes like Ruben Zepuntke who only come in via a race start list. bundledAthletes()
  // renders instantly; getAthletes() refreshes from the hosted data.
  const { data: allAthletes } = useQuery({
    queryKey: ['athletes'],
    queryFn: getAthletes,
    placeholderData: bundledAthletes(),
  });

  const q = fold(query.trim());
  const { foundAthletes, foundRaces } = useMemo(() => {
    if (!q) return { foundAthletes: [], foundRaces: [] };
    return {
      foundAthletes: (allAthletes ?? [])
        .filter((a) => fold(a.name).includes(q))
        .sort((a, b) => fameScore(b) - fameScore(a))
        .slice(0, 40),
      foundRaces: (feed ?? [])
        .filter((i) => fold(`${nameOf(i)} ${placeOf(i) ?? ''} ${ctryOf(i) ?? ''}`).includes(q))
        .slice(0, 40),
    };
  }, [q, feed, allAthletes]);

  const hasResults = foundAthletes.length > 0 || foundRaces.length > 0;

  const go = (path: string) => {
    if (router.canGoBack()) router.back();
    router.push(path);
  };
  const openEvent = (i: FeedItem) => go(i.kind === 'pro' ? `/event/${i.id}` : `/local/${i.id}`);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.searchRow}>
        <View style={[styles.inputWrap, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
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
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
      </View>

      {!q ? (
        <EmptyState icon="search-outline" message={t('search.prompt')} />
      ) : !hasResults ? (
        <View style={{ flex: 1 }}>
          <EmptyState icon="sad-outline" message={t('search.empty')} />
          <ReportNotFound type="general" prefill={query.trim()} />
          <View style={{ height: insets.bottom + Spacing.three }} />
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          {foundAthletes.length > 0 && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
                {t('search.athletes').toUpperCase()}
              </ThemedText>
              {foundAthletes.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => go(`/athlete/${a.id}`)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: theme.border },
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <ThemedText style={styles.flag}>{countryFlag(a.country)}</ThemedText>
                  <ThemedText type="smallBold" style={{ flex: 1 }}>
                    {a.name}
                  </ThemedText>
                  <FavoriteButton kind="athlete" id={a.id} size={20} />
                </Pressable>
              ))}
            </>
          )}

          {foundRaces.length > 0 && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
                {t('search.races').toUpperCase()}
              </ThemedText>
              {foundRaces.map((i) => (
                <Pressable
                  key={`${i.kind}-${i.id}`}
                  onPress={() => openEvent(i)}
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
                      {countryFlag(ctryOf(i))} {placeOf(i)}
                    </ThemedText>
                  </View>
                  {i.kind === 'pro' && i.race.series ? (
                    <SeriesTag series={i.race.series} />
                  ) : i.kind !== 'pro' && i.event.series ? (
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800', fontSize: 11 }}>
                      {i.event.series}
                    </ThemedText>
                  ) : null}
                </Pressable>
              ))}
            </>
          )}
          <ReportNotFound type="general" prefill={query.trim()} />
          <View style={{ height: insets.bottom + Spacing.five }} />
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: 12,
  },
  input: { flex: 1, fontSize: 16, padding: 0 },
  section: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flag: { fontSize: 22 },
});
