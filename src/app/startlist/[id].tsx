import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Countdown } from '@/components/Countdown';
import { SeriesTag } from '@/components/SeriesTag';
import { EmptyState, LoadingState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { countryFlag, formatDate } from '@/lib/format';
import { getRaceStartList, type StartListEntry } from '@/services/races';

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
// Deterministic avatar colour from the name → a stable, varied palette (no photos needed).
const avatarColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 52%, 45%)`;
};

export default function StartListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();
  const [tab, setTab] = useState(0);

  const { data: race, isLoading } = useQuery({
    queryKey: ['startlist', id],
    queryFn: () => getRaceStartList(id),
  });

  if (isLoading) return <LoadingState />;
  if (!race) return <EmptyState message={t('startlist.empty')} />;

  const women = race.entries.filter((e) => e.athlete.gender === 'women');
  const men = race.entries.filter((e) => e.athlete.gender === 'men');
  const rest = race.entries.filter((e) => e.athlete.gender !== 'women' && e.athlete.gender !== 'men');
  const groups = [
    { label: t('startlist.women'), items: women },
    { label: t('startlist.men'), items: men },
    { label: t('startlist.field'), items: rest },
  ].filter((g) => g.items.length);
  const active = groups[Math.min(tab, groups.length - 1)] ?? { label: '', items: [] };

  const nations = new Set(race.entries.map((e) => e.athlete.country).filter(Boolean)).size;
  const officialUrl = race.entries.map((e) => e.start.url).find(Boolean);

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: race.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: theme.primary }]}>
          <View style={styles.heroTop}>
            {race.series && (
              <View style={styles.heroChip}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 11, letterSpacing: 0.5 }}>
                  {t(`series.${race.series}`).toUpperCase()}
                </ThemedText>
              </View>
            )}
            <ThemedText type="smallBold" style={{ color: theme.onPrimary, opacity: 0.85 }}>
              {t('startlist.title').toUpperCase()}
            </ThemedText>
          </View>

          <ThemedText type="title" style={[styles.heroName, { color: theme.onPrimary }]}>
            {race.name}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.onPrimary, opacity: 0.9 }}>
            {race.location ? `${race.location} · ` : ''}
            {formatDate(race.date, lang)}
          </ThemedText>

          <View style={styles.heroCountdown}>
            <Countdown date={race.date} color={theme.onPrimary} />
          </View>

          <View style={styles.statRow}>
            <Stat value={race.entries.length} label={t('startlist.statPros')} onColor={theme.onPrimary} />
            <Stat value={nations} label={t('startlist.statNations')} onColor={theme.onPrimary} />
            {!!women.length && <Stat value={women.length} label="♀" onColor={theme.onPrimary} />}
            {!!men.length && <Stat value={men.length} label="♂" onColor={theme.onPrimary} />}
          </View>
        </View>

        {/* Gender segmented control */}
        {groups.length > 1 && (
          <View style={[styles.segments, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            {groups.map((g, i) => {
              const on = i === Math.min(tab, groups.length - 1);
              return (
                <Pressable
                  key={g.label}
                  onPress={() => setTab(i)}
                  style={[styles.segment, on && { backgroundColor: theme.primary }]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: on ? theme.onPrimary : theme.textSecondary, fontSize: 13 }}>
                    {g.label} · {g.items.length}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Athlete cards */}
        <View style={styles.list}>
          {active.items.map(({ athlete, start }: StartListEntry, idx) => (
            <Pressable
              key={athlete.id}
              onPress={() => router.push(`/athlete/${athlete.id}`)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                pressed && { opacity: 0.7 },
              ]}>
              <ThemedText type="small" style={[styles.rank, { color: theme.textSecondary }]}>
                {idx + 1}
              </ThemedText>
              <View style={[styles.avatar, { backgroundColor: avatarColor(athlete.name) }]}>
                <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 13 }}>
                  {initials(athlete.name)}
                </ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {athlete.name}
                </ThemedText>
                {!!athlete.country && (
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                    {countryFlag(athlete.country)} {athlete.country}
                  </ThemedText>
                )}
              </View>
              {start.confidence === 'expected' && (
                <View style={[styles.tag, { borderColor: theme.border }]}>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>
                    {t('profile.expected')}
                  </ThemedText>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </Pressable>
          ))}
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

        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          {t('startlist.disclaimer')}
          {'\n'}
          {t('startlist.notAffiliated')}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function Stat({ value, label, onColor }: { value: number | string; label: string; onColor: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="subtitle" style={{ color: onColor, fontSize: 18 }}>
        {value}
      </ThemedText>
      <ThemedText type="small" style={{ color: onColor, opacity: 0.85, fontSize: 11 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  hero: { borderRadius: 20, padding: Spacing.three, gap: Spacing.one, marginTop: Spacing.one },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroChip: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  heroName: { fontSize: 26, lineHeight: 30, marginTop: Spacing.one },
  heroCountdown: { marginTop: Spacing.two },
  statRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  stat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingVertical: Spacing.one,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 11 },
  list: { gap: Spacing.one },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 22, textAlign: 'center', fontSize: 12, fontVariant: ['tabular-nums'] },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tag: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  official: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.one },
  footnote: { marginTop: Spacing.two, fontSize: 11, lineHeight: 15, opacity: 0.6 },
});
