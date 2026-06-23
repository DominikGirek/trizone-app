import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SeriesTag } from '@/components/SeriesTag';
import { EmptyState, LoadingState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { countryFlag, formatDate } from '@/lib/format';
import { getRaceStartList, sourceLabel } from '@/services/races';

export default function StartListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();

  const { data: race, isLoading } = useQuery({
    queryKey: ['startlist', id],
    queryFn: () => getRaceStartList(id),
  });

  if (isLoading) return <LoadingState />;
  if (!race) return <EmptyState message={t('startlist.empty')} />;

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t('startlist.title') }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.raceName}>
          {race.name}
        </ThemedText>
        <View style={styles.metaRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDate(race.date, lang)}
            {race.location ? ` · ${race.location}` : ''}
          </ThemedText>
          {race.series && <SeriesTag series={race.series} />}
        </View>

        <View style={[styles.disclaimer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            {t('startlist.disclaimer')}
          </ThemedText>
        </View>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
          {t('startlist.count', { count: race.entries.length }).toUpperCase()}
        </ThemedText>

        {race.entries.map(({ athlete, start }) => {
          const src = sourceLabel(start.url);
          return (
            <Pressable
              key={athlete.id}
              onPress={() => router.push(`/athlete/${athlete.id}`)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border },
                pressed && { backgroundColor: theme.backgroundElement },
              ]}>
              <ThemedText style={styles.flag}>{countryFlag(athlete.country)}</ThemedText>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {athlete.name}
                </ThemedText>
                {!!src && (
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                    {t('startlist.via', { source: src })}
                  </ThemedText>
                )}
              </View>
              {start.confidence && (
                <ThemedText
                  type="small"
                  style={{ fontSize: 11, color: start.confidence === 'confirmed' ? theme.primary : theme.textSecondary }}>
                  {start.confidence === 'confirmed' ? `✓ ${t('profile.confirmed')}` : t('profile.expected')}
                </ThemedText>
              )}
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </Pressable>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.one, paddingBottom: Spacing.five },
  raceName: { marginTop: Spacing.two },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  disclaimer: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
    padding: Spacing.two,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.two,
  },
  section: { marginTop: Spacing.two, marginBottom: 2, letterSpacing: 0.4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flag: { fontSize: 22, width: 30, textAlign: 'center' },
});
