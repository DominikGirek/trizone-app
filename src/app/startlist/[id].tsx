import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SeriesTag } from '@/components/SeriesTag';
import { EmptyState, LoadingState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { countryFlag, formatDate } from '@/lib/format';
import { getRaceStartList } from '@/services/races';

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

  // Separate Pro Women / Pro Men tables; any entry without a known gender goes last.
  const women = race.entries.filter((e) => e.athlete.gender === 'women');
  const men = race.entries.filter((e) => e.athlete.gender === 'men');
  const rest = race.entries.filter((e) => e.athlete.gender !== 'women' && e.athlete.gender !== 'men');
  const groups = [
    { label: t('startlist.women'), items: women },
    { label: t('startlist.men'), items: men },
    { label: women.length || men.length ? t('startlist.more') : t('startlist.field'), items: rest },
  ].filter((g) => g.items.length);

  // Link back to the official start list (attribution + sends users to the source).
  const officialUrl = race.entries.map((e) => e.start.url).find(Boolean);

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
            {'\n\n'}
            {t('startlist.notAffiliated')}
          </ThemedText>
        </View>

        {!!officialUrl && (
          <Pressable
            onPress={() => Linking.openURL(officialUrl)}
            style={({ pressed }) => [styles.official, pressed && { opacity: 0.6 }]}>
            <Ionicons name="open-outline" size={16} color={theme.primary} />
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {t('startlist.official')}
            </ThemedText>
          </Pressable>
        )}

        {groups.map(({ label, items }) => (
          <View key={label}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
              {label.toUpperCase()} · {items.length}
            </ThemedText>
            {items.map(({ athlete, start }) => {
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
          </View>
        ))}
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
  official: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.one, marginBottom: Spacing.one },
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
