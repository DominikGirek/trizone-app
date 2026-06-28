import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, StyleSheet, Switch, View } from 'react-native';

import { InviteCode } from '@/components/InviteCode';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/Toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { fetchGroupLeaderboard, fetchMyGroups, setGroupPublic } from '@/services/tippspielSync';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { show } = useToast();
  const qc = useQueryClient();

  // Always refetch on entry: a freshly created/joined group may not be in any cached list yet.
  const { data: groups = [] } = useQuery({
    queryKey: ['myGroups'],
    queryFn: fetchMyGroups,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const group = groups.find((g) => g.id === id);
  const { data: board = [], isLoading } = useQuery({
    queryKey: ['groupBoard', id],
    queryFn: () => fetchGroupLeaderboard(id!),
    enabled: !!id,
  });

  const onShare = async () => {
    if (!group) return;
    haptics.light();
    await Share.share({ message: t('group.shareMsg', { name: group.name, code: group.invite_code }) }).catch(() => {});
  };

  const onTogglePublic = async (val: boolean) => {
    if (!group) return;
    haptics.light();
    await setGroupPublic(group.id, val);
    qc.invalidateQueries({ queryKey: ['myGroups'] });
    qc.invalidateQueries({ queryKey: ['groupGlobal'] });
    show(val ? t('group.nowPublic') : t('group.nowPrivate'), 'checkmark-circle');
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: group?.name ?? t('group.fallbackTitle'), headerBackTitle: '' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Invite code (clean, never clipped) */}
        {group ? (
          <InviteCode code={group.invite_code} onShare={onShare} />
        ) : (
          <View style={[styles.invite, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">{t('group.loading')}</ThemedText>
          </View>
        )}

        {/* Opt-in to the global group ranking */}
        <View style={[styles.optRow, { borderColor: theme.border }]}>
          <View style={styles.flex}>
            <ThemedText type="smallBold">{t('group.publicTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.optHint}>
              {t('group.publicHint')}
            </ThemedText>
          </View>
          <Switch
            value={!!group?.is_public}
            onValueChange={onTogglePublic}
            trackColor={{ true: theme.primary, false: theme.border }}
          />
        </View>

        {/* Member leaderboard */}
        <ThemedText type="smallBold" style={styles.section}>{t('group.standings')}</ThemedText>
        {board.length > 0 ? (
          <View style={[styles.board, { borderColor: theme.border }]}>
            {board.map((r, i) => (
              <View key={r.user_id} style={[styles.boardRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <ThemedText type="smallBold" style={styles.rank}>{i + 1}</ThemedText>
                <ThemedText type="small" style={styles.flex} numberOfLines={1}>{r.handle}</ThemedText>
                <ThemedText type="smallBold">{r.points} {t('tippspiel.points')}</ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.empty, { borderColor: theme.border }]}>
            <Ionicons name="people-outline" size={20} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {isLoading ? t('group.loading') : t('group.standingsEmpty')}
            </ThemedText>
          </View>
        )}

        <ThemedText type="small" themeColor="textSecondary" style={styles.foot}>
          {t('group.foot')}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
  flex: { flex: 1 },
  invite: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.one },
  code: { fontSize: 34, fontWeight: '800', letterSpacing: 6, fontVariant: ['tabular-nums'] },
  inviteHint: { textAlign: 'center', lineHeight: 18, marginBottom: Spacing.two },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two + 2, borderRadius: 999 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginTop: Spacing.two },
  optHint: { lineHeight: 18, marginTop: 2 },
  section: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginTop: Spacing.three, marginBottom: Spacing.one },
  board: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
  rank: { width: 18, textAlign: 'center' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: 14, borderWidth: 1 },
  foot: { lineHeight: 18, marginTop: Spacing.three },
});
