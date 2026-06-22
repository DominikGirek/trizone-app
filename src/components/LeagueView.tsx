import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';

import { ListSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getAllLeagues, leaguesMatchingTeam, type LeagueEntry } from '@/services/leagues';

const GROUP_ORDER = [
  '1. Bundesliga',
  '2. Bundesliga',
  'Regionalliga',
  'Landesliga',
  'Nordrhein-Westfalen',
  'Bayern',
  'Baden-Württemberg',
  'Hessen',
  'Weitere',
];

function LeagueRow({ item, matchedTeam }: { item: LeagueEntry; matchedTeam?: string }) {
  const theme = useTheme();
  const { t } = useTranslation();

  const onPress = () => {
    if (item.live && item.divisionGuid) router.push(`/league/${item.divisionGuid}`);
    else if (item.url) WebBrowser.openBrowserAsync(item.url);
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.border },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <View style={styles.rowBody}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {item.name}
        </ThemedText>
        {matchedTeam ? (
          <ThemedText type="small" numberOfLines={1} style={{ color: theme.primary, fontSize: 11 }}>
            {t('league.teamMatch', { team: matchedTeam })}
          </ThemedText>
        ) : (
          <ThemedText
            type="small"
            style={{ color: item.live ? theme.success : theme.textSecondary, fontSize: 11 }}>
            {item.live ? `● ${t('league.live')}` : `↗ ${t('league.external')}`}
          </ThemedText>
        )}
      </View>
      <Ionicons
        name={item.live ? 'chevron-forward' : 'open-outline'}
        size={18}
        color={theme.textSecondary}
      />
    </Pressable>
  );
}

export function LeagueView() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const { data: leagues, isLoading } = useQuery({ queryKey: ['allLeagues'], queryFn: getAllLeagues });

  const teamMatches = useMemo(() => leaguesMatchingTeam(query), [query]);
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (leagues ?? []).filter(
      (l) => !q || l.name.toLowerCase().includes(q) || (!!l.divisionGuid && teamMatches.has(l.divisionGuid)),
    );
    const byGroup = new Map<string, LeagueEntry[]>();
    for (const l of filtered) {
      if (!byGroup.has(l.group)) byGroup.set(l.group, []);
      byGroup.get(l.group)!.push(l);
    }
    return [...byGroup.entries()]
      .sort((a, b) => {
        const ia = GROUP_ORDER.indexOf(a[0]);
        const ib = GROUP_ORDER.indexOf(b[0]);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
      .map(([title, data]) => ({ title, data }));
  }, [leagues, query, teamMatches]);

  if (isLoading) return <ListSkeleton count={10} />;

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <View style={[styles.inputWrap, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('league.searchPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text }]}
          />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
            {section.title.toUpperCase()}
          </ThemedText>
        )}
        renderItem={({ item }) => (
          <LeagueRow item={item} matchedTeam={item.divisionGuid ? teamMatches.get(item.divisionGuid) : undefined} />
        )}
        ListEmptyComponent={<EmptyState icon="search-outline" message={t('search.empty')} />}
        ListFooterComponent={
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t('league.coverageNote')}
          </ThemedText>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: 12,
  },
  input: { flex: 1, fontSize: 16, padding: 0 },
  sectionHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, gap: 2 },
  note: { padding: Spacing.three, textAlign: 'center', lineHeight: 16 },
});
