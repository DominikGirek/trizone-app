import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { formatDate } from '@/lib/format';
import { getAthletesByIds } from '@/services/athletes';
import { fetchMemberTips } from '@/services/tippspielSync';

/**
 * A group member's tips, viewable by fellow members. The backend only ever returns LOCKED races
 * (anti-cheat) and honours the member's privacy switch — so an empty list means "private, or no
 * started races yet". Own tips always come back.
 */
export default function MemberTipsScreen() {
  const { group, user, name } = useLocalSearchParams<{ group: string; user: string; name?: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();

  const { data: tips = [], isLoading } = useQuery({
    queryKey: ['memberTips', group, user],
    queryFn: () => fetchMemberTips(group!, user!),
    enabled: !!group && !!user,
  });

  // Resolve every picked athlete slug → display name in one lookup.
  const slugs = useMemo(() => [...new Set(tips.flatMap((tp) => [...tp.men, ...tp.women]).filter(Boolean))], [tips]);
  const { data: athletes = [] } = useQuery({
    queryKey: ['athletesByIds', slugs],
    queryFn: () => getAthletesByIds(slugs),
    enabled: slugs.length > 0,
  });
  const nameOf = useMemo(() => {
    const m = new Map(athletes.map((a) => [a.id, a.name]));
    return (slug: string) => m.get(slug) ?? slug.replace(/-/g, ' ');
  }, [athletes]);

  const Picks = ({ ids }: { ids: string[] }) => {
    const picked = ids.filter(Boolean);
    if (!picked.length) return null;
    return (
      <View style={styles.picks}>
        {picked.map((slug, i) => (
          <View key={`${slug}-${i}`} style={[styles.pick, { backgroundColor: theme.background }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.pickRank}>{i + 1}</ThemedText>
            <ThemedText type="small" numberOfLines={1} style={styles.flex}>{nameOf(slug)}</ThemedText>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <View style={styles.head}>
        <View style={styles.flex}>
          <ThemedText type="subtitle" numberOfLines={1}>{name || t('memberTips.title')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t('memberTips.subtitle')}</ThemedText>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tips.length === 0 ? (
          <View style={[styles.empty, { borderColor: theme.border }]}>
            <Ionicons name="lock-closed-outline" size={22} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {isLoading ? t('group.loading') : t('memberTips.empty')}
            </ThemedText>
          </View>
        ) : (
          tips.map((tp) => (
            <View key={tp.race_id} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" numberOfLines={1}>{tp.race_name ?? t('tippspiel.aRace')}</ThemedText>
              {tp.race_date && (
                <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.one }}>
                  {formatDate(tp.race_date, lang)}
                </ThemedText>
              )}
              {tp.men.some(Boolean) && (
                <>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.genderLabel}>{t('memberTips.men')}</ThemedText>
                  <Picks ids={tp.men} />
                </>
              )}
              {tp.women.some(Boolean) && (
                <>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.genderLabel}>{t('memberTips.women')}</ThemedText>
                  <Picks ids={tp.women} />
                </>
              )}
            </View>
          ))
        )}
        <ThemedText type="small" themeColor="textSecondary" style={styles.foot}>{t('memberTips.foot')}</ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
  card: { borderRadius: 14, padding: Spacing.three, gap: 2 },
  genderLabel: { marginTop: Spacing.one, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 11 },
  picks: { gap: 4, marginTop: 4 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: 5, borderRadius: 8 },
  pickRank: { width: 14, textAlign: 'center', fontVariant: ['tabular-nums'] },
  empty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: 14, borderWidth: 1 },
  foot: { lineHeight: 17, marginTop: Spacing.two },
});
