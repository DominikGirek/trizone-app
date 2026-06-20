import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Pill } from '@/components/Pill';
import { ListSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchRRConfig,
  fetchRRResults,
  pickList,
  type LiveRow,
} from '@/services/raceresult';

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

function ResultRow({ row }: { row: LiveRow }) {
  const theme = useTheme();
  const splits = [
    row.swim && `🏊 ${row.swim}`,
    row.bike && `🚴 ${row.bike}`,
    row.run && `🏃 ${row.run}`,
  ].filter(Boolean);
  const medal = row.position === '1.' ? '#F5B301' : row.position === '2.' ? '#9CA3AF' : row.position === '3.' ? '#CD7F32' : theme.text;

  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <ThemedText style={[styles.pos, { color: medal }]}>{row.position ?? '–'}</ThemedText>
      <View style={styles.rowBody}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {row.name ?? '—'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {[row.ageClass, row.club].filter(Boolean).join(' · ')}
        </ThemedText>
        {splits.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.splits} numberOfLines={1}>
            {splits.join('   ')}
          </ThemedText>
        )}
      </View>
      <ThemedText type="smallBold" style={styles.time}>
        {row.time ?? ''}
      </ThemedText>
    </View>
  );
}

export default function LiveScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const [contest, setContest] = useState<string | null>(null);

  const { data: config, isLoading: cfgLoading } = useQuery({
    queryKey: ['rrConfig', eventId],
    queryFn: () => fetchRRConfig(eventId),
  });

  // Only contests that actually have a result/live list.
  const contests = useMemo(
    () => (config ? config.contests.filter((c) => pickList(config, c.id)) : []),
    [config],
  );
  const activeContest = contest ?? contests[0]?.id ?? null;
  const list = config && activeContest ? pickList(config, activeContest) : undefined;

  const { data: results, isLoading: resLoading } = useQuery({
    queryKey: ['rrResults', eventId, activeContest],
    queryFn: () => fetchRRResults(eventId, config!.key, list!.name, activeContest!),
    enabled: !!config && !!list && !!activeContest,
    refetchInterval: config?.showLive ? 20000 : false,
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('live.title') }} />

      <View style={[styles.header, { borderColor: theme.border }]}>
        <View style={styles.headerTop}>
          <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
            {config?.eventName ?? ''}
          </ThemedText>
          {config &&
            (config.showLive ? (
              <Pill label={t('live.liveNow')} color={theme.onPrimary} background={theme.primary} dot />
            ) : (
              <Pill label={t('live.final')} color={theme.success} background={theme.backgroundElement} />
            ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {t('live.poweredBy')}
        </ThemedText>
      </View>

      {contests.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {contests.map((c) => (
            <Chip key={c.id} label={c.name} active={c.id === activeContest} onPress={() => setContest(c.id)} />
          ))}
        </ScrollView>
      )}

      {cfgLoading || resLoading ? (
        <ListSkeleton count={8} />
      ) : !results || results.groups.length === 0 ? (
        <EmptyState icon="podium-outline" message={t('live.noData')} />
      ) : (
        <ScrollView>
          {results.groups.map((g, gi) => (
            <View key={`${g.title}-${gi}`}>
              {!!g.title && (
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupHeader}>
                  {g.title.toUpperCase()}
                </ThemedText>
              )}
              {g.rows.map((row, i) => (
                <ResultRow key={`${row.bib}-${i}`} row={row} />
              ))}
            </View>
          ))}
          <View style={{ height: Spacing.six }} />
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chipRow: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
  groupHeader: {
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
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pos: { width: 34, fontSize: 16, fontWeight: '800' },
  rowBody: { flex: 1, gap: 1 },
  splits: { fontSize: 11 },
  time: { width: 72, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
