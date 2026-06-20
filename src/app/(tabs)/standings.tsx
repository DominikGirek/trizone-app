import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LeagueView } from '@/components/LeagueView';
import { RankingList } from '@/components/RankingList';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ListSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBar } from '@/components/TopBar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getRanking } from '@/services/rankings';
import type { Gender, SeriesId } from '@/types';

type Mode = 'leagues' | 'world';
type RankTab = Extract<SeriesId, 'wtcs' | 'pto'> | 'improseries';

const RANK_TABS: RankTab[] = ['wtcs', 'pto', 'improseries'];
const IM_PRO_SERIES_URL = 'https://www.ironman.com/im-pro-series';

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

export default function StandingsScreen() {
  const { t } = useTranslation();
  // Local leagues first/default — age-groupers care about them more than WTCS.
  const [mode, setMode] = useState<Mode>('leagues');

  return (
    <ThemedView style={styles.container}>
      <TopBar title={t('tabs.standings')} />
      <View style={styles.modeWrap}>
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          segments={[
            { value: 'leagues', label: t('standings.leagues') },
            { value: 'world', label: t('standings.worldRanking') },
          ]}
        />
      </View>
      {mode === 'leagues' ? <LeagueView /> : <WorldRanking />}
    </ThemedView>
  );
}

function rankLabel(t: (k: string) => string, tab: RankTab): string {
  return tab === 'improseries' ? t('standings.imProSeries') : t(`series.${tab}`);
}

function WorldRanking() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<RankTab>('wtcs');
  const [gender, setGender] = useState<Gender>('men');

  const { data: table, isLoading } = useQuery({
    queryKey: ['ranking', tab, gender],
    queryFn: () => getRanking(tab as SeriesId, gender),
    enabled: tab !== 'improseries',
  });

  return (
    <View style={styles.container}>
      <View style={styles.chipRow}>
        {RANK_TABS.map((s) => (
          <Chip key={s} label={rankLabel(t, s)} active={s === tab} onPress={() => setTab(s)} />
        ))}
      </View>

      {tab === 'improseries' ? (
        <ImProSeries />
      ) : (
        <>
          <View style={styles.genderWrap}>
            <SegmentedControl<Gender>
              value={gender}
              onChange={setGender}
              segments={[
                { value: 'men', label: t('common.men') },
                { value: 'women', label: t('common.women') },
              ]}
            />
          </View>

          {table?.updatedAt ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
              {t('standings.updatedAt', {
                date: new Date(table.updatedAt).toLocaleDateString(i18n.language),
              })}
              {table.source ? ` · ${table.source}` : ''}
            </ThemedText>
          ) : null}

          {isLoading ? (
            <ListSkeleton />
          ) : table && table.entries.length ? (
            <ScrollView>
              <RankingList entries={table.entries} onSelectAthlete={(id) => router.push(`/athlete/${id}`)} />
            </ScrollView>
          ) : (
            <EmptyState message={t('common.noResults')} />
          )}
        </>
      )}
    </View>
  );
}

/** IRONMAN Pro Series — its full table is loaded client-side upstream, so we
 *  link out to the official standings rather than ship a brittle scraper. */
function ImProSeries() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.imWrap}>
      <ThemedText type="subtitle" style={styles.imTitle}>
        {t('standings.imProSeries')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.imNote}>
        {t('standings.imProSeriesNote')}
      </ThemedText>
      <Pressable
        onPress={() => WebBrowser.openBrowserAsync(IM_PRO_SERIES_URL)}
        style={[styles.imButton, { backgroundColor: theme.primary }]}>
        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
          {t('standings.openOfficial')}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modeWrap: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  genderWrap: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  meta: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  imWrap: { padding: Spacing.four, gap: Spacing.three, alignItems: 'flex-start' },
  imTitle: { marginTop: Spacing.two },
  imNote: { lineHeight: 20 },
  imButton: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: 999, marginTop: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
});
