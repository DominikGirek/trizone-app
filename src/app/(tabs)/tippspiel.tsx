import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBar } from '@/components/TopBar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { countryFlag, formatDate } from '@/lib/format';
import { isTipLocked, TIP_SIZE } from '@/lib/tippspiel';
import { fetchGroupGlobalLeaderboard, fetchLeaderboard, fetchMyGroups } from '@/services/tippspielSync';
import { useAuth } from '@/store/auth';
import { useTips } from '@/store/tips';

export default function TippspielScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();
  const { list } = useTips();
  const { signedIn, displayName } = useAuth();
  const { data: board = [] } = useQuery({ queryKey: ['leaderboard'], queryFn: () => fetchLeaderboard() });
  const { data: myGroups = [], refetch: refetchGroups } = useQuery({ queryKey: ['myGroups'], queryFn: fetchMyGroups });
  const { data: groupGlobal = [] } = useQuery({ queryKey: ['groupGlobal'], queryFn: () => fetchGroupGlobalLeaderboard() });

  // Refresh "my groups" whenever the hub regains focus (e.g. after creating/joining one).
  useFocusEffect(useCallback(() => { refetchGroups(); }, [refetchGroups]));

  const myTips = list();

  return (
    <ThemedView style={styles.container}>
      <TopBar title={t('tippspiel.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
          {t('tippspiel.intro')}
        </ThemedText>

        {/* Account / sign-in */}
        <Pressable
          onPress={() => router.push('/login')}
          style={({ pressed }) => [styles.account, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.8 }]}>
          <Ionicons name={signedIn ? 'person-circle' : 'log-in-outline'} size={26} color={theme.primary} />
          <View style={styles.flex}>
            {signedIn ? (
              <ThemedText type="smallBold" numberOfLines={1}>
                {t('tippspiel.account', { name: displayName ?? '' })}
              </ThemedText>
            ) : (
              <>
                <ThemedText type="smallBold">{t('tippspiel.signInCta')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('tippspiel.signInSub')}
                </ThemedText>
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>

        {/* Meine Tipps */}
        <ThemedText type="smallBold" style={styles.section}>
          {t('tippspiel.myTips')}
        </ThemedText>
        {myTips.length === 0 ? (
          <Pressable
            onPress={() => router.push('/events')}
            style={({ pressed }) => [styles.empty, { borderColor: theme.border }, pressed && { opacity: 0.7 }]}>
            <Ionicons name="flag-outline" size={22} color={theme.primary} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">{t('tippspiel.emptyTitle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('tippspiel.emptyHint')}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : (
          myTips.map((tp) => {
            const count = [...tp.men, ...tp.women].filter(Boolean).length;
            const locked = tp.date ? isTipLocked(tp.date) : false;
            return (
              <Pressable
                key={tp.raceId}
                onPress={() => router.push(`/race/${tp.raceId}?kind=${tp.kind ?? 'local'}`)}
                style={({ pressed }) => [styles.tipCard, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.8 }]}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {tp.country ? `${countryFlag(tp.country)} ` : ''}
                    {tp.name ?? t('tippspiel.aRace')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {tp.date ? `${formatDate(tp.date, lang)} · ` : ''}
                    {t('tippspiel.picked', { count, total: TIP_SIZE * 2 })}
                  </ThemedText>
                </View>
                <View style={[styles.statusChip, { backgroundColor: theme.background }]}>
                  <ThemedText type="small" style={{ color: locked ? theme.textSecondary : theme.primary }}>
                    {locked ? t('tippspiel.locked') : t('tippspiel.open')}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })
        )}

        {/* Globale Rangliste — live (points only) */}
        <ThemedText type="smallBold" style={styles.section}>
          {t('tippspiel.global')}
        </ThemedText>
        {board.length > 0 ? (
          <View style={[styles.board, { borderColor: theme.border }]}>
            {board.map((r, i) => (
              <View key={r.user_id} style={[styles.boardRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <ThemedText type="smallBold" style={styles.rank}>
                  {i + 1}
                </ThemedText>
                <ThemedText type="small" style={styles.flex} numberOfLines={1}>
                  {r.handle}
                </ThemedText>
                <ThemedText type="smallBold">
                  {r.points} {t('tippspiel.points')}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.empty, { borderColor: theme.border }]}>
            <Ionicons name="trophy-outline" size={20} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {t('tippspiel.globalEmpty')}
            </ThemedText>
          </View>
        )}

        {/* Gruppen */}
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold" style={styles.section}>
            {t('group.myGroups')}
          </ThemedText>
          <Pressable onPress={() => router.push('/group/new')} hitSlop={8} style={styles.addRow}>
            <Ionicons name="add" size={16} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary }}>{t('group.add')}</ThemedText>
          </Pressable>
        </View>
        {myGroups.length > 0 ? (
          myGroups.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => router.push(`/group/${g.id}`)}
              style={({ pressed }) => [styles.tipCard, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.8 }]}>
              <Ionicons name="people" size={20} color={theme.primary} />
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>{g.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('group.memberCount', { count: g.members ?? 1 })}
                  {g.is_public ? ` · ${t('group.public')}` : ''}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          ))
        ) : (
          <Pressable
            onPress={() => router.push('/group/new')}
            style={({ pressed }) => [styles.empty, { borderColor: theme.border }, pressed && { opacity: 0.7 }]}>
            <Ionicons name="people-outline" size={22} color={theme.primary} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">{t('group.emptyTitle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{t('group.emptyHint')}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>
        )}

        {/* Globale Gruppen — opt-in */}
        {groupGlobal.length > 0 && (
          <>
            <ThemedText type="smallBold" style={styles.section}>{t('group.globalTitle')}</ThemedText>
            <View style={[styles.board, { borderColor: theme.border }]}>
              {groupGlobal.slice(0, 5).map((g, i) => (
                <View key={g.group_id} style={[styles.boardRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <ThemedText type="smallBold" style={styles.rank}>{i + 1}</ThemedText>
                  <ThemedText type="small" style={styles.flex} numberOfLines={1}>{g.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('group.avgPoints', { pts: Math.round(Number(g.avg_points)) })}
                  </ThemedText>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.one },
  flex: { flex: 1 },
  intro: { lineHeight: 19, marginBottom: Spacing.two },
  account: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: 14 },
  section: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginTop: Spacing.three, marginBottom: Spacing.one },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: Spacing.three },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
    marginBottom: Spacing.one + 2,
  },
  statusChip: { paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: 999 },
  previewChip: { paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: 999, marginTop: Spacing.three },
  board: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
  rank: { width: 18, textAlign: 'center' },
  note: { lineHeight: 18, marginTop: Spacing.two },
  soon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.four,
  },
});
