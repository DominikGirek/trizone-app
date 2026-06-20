import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { ListSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/States';
import { StatusPill } from '@/components/StatusPill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { formatDate } from '@/lib/format';
import { getLeagueTable } from '@/services/leagues';

type Tab = 'table' | 'fixtures';

export default function LeagueDetailScreen() {
  const { guid } = useLocalSearchParams<{ guid: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('table');

  const { data, isLoading } = useQuery({
    queryKey: ['leagueTable', guid],
    queryFn: () => getLeagueTable(guid),
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: data?.name || t('standings.leagues') }} />

      <View style={styles.segmentWrap}>
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          segments={[
            { value: 'table', label: t('league.table') },
            { value: 'fixtures', label: t('league.fixtures') },
          ]}
        />
      </View>

      {isLoading ? (
        <ListSkeleton count={8} />
      ) : !data ? (
        <EmptyState message={t('league.empty')} />
      ) : tab === 'table' ? (
        data.teams.length === 0 ? (
          <EmptyState icon="podium-outline" message={t('league.empty')} />
        ) : (
          <ScrollView>
            <View style={[styles.head, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.posCol}>
                {t('league.place')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.teamCol}>
                {t('league.team')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.ptsCol}>
                {t('common.points')}
              </ThemedText>
            </View>
            {data.teams.map((team, i) => (
              <View key={`${team.place}-${i}`} style={[styles.row, { borderColor: theme.border }]}>
                <ThemedText style={[styles.posCol, styles.pos, { color: i === 0 ? '#F5B301' : theme.text }]}>
                  {team.place}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.teamCol} numberOfLines={1}>
                  {team.team}
                </ThemedText>
                <ThemedText type="smallBold" style={[styles.ptsCol, styles.pts]}>
                  {team.points}
                </ThemedText>
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary" style={styles.source}>
              {t('league.source')}
            </ThemedText>
          </ScrollView>
        )
      ) : (
        <ScrollView>
          {data.fixtures.map((f, i) => (
            <View key={`${f.name}-${i}`} style={[styles.fixture, { borderColor: theme.border }]}>
              <View style={styles.fxDate}>
                <ThemedText style={styles.fxDay}>{new Date(f.date).getDate()}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.fxMonth}>
                  {formatDate(f.date, lang).replace(/^\d+\.?\s*/, '')}
                </ThemedText>
              </View>
              <View style={styles.fxBody}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {f.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {f.city}
                </ThemedText>
              </View>
              <StatusPill status={f.status} />
            </View>
          ))}
          <ThemedText type="small" themeColor="textSecondary" style={styles.source}>
            {t('league.source')}
          </ThemedText>
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentWrap: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  posCol: { width: 36 },
  pos: { fontSize: 16, fontWeight: '800' },
  teamCol: { flex: 1 },
  ptsCol: { width: 56, textAlign: 'right' },
  pts: { fontVariant: ['tabular-nums'] },
  fixture: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fxDate: { alignItems: 'center', width: 44 },
  fxDay: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  fxMonth: { fontSize: 11, textTransform: 'uppercase' },
  fxBody: { flex: 1, gap: 2 },
  source: { padding: Spacing.three, textAlign: 'center' },
});
