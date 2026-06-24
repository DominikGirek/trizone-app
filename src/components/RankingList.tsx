import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/FavoriteButton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countryFlag } from '@/lib/format';
import type { RankingEntry } from '@/types';

// Gold / silver / bronze for the top three — a glanceable leaderboard accent.
const MEDAL = ['#D4AF37', '#B7BCC2', '#C8814B'];

function Movement({ value }: { value?: number }) {
  const theme = useTheme();
  if (!value) return <Ionicons name="remove" size={12} color={theme.textSecondary} />;
  const up = value > 0;
  return (
    <View style={styles.movement}>
      <Ionicons
        name={up ? 'caret-up' : 'caret-down'}
        size={12}
        color={up ? theme.success : theme.run}
      />
      <ThemedText type="small" style={{ fontSize: 11, color: up ? theme.success : theme.run }}>
        {Math.abs(value)}
      </ThemedText>
    </View>
  );
}

export function RankingList({
  entries,
  onSelectAthlete,
}: {
  entries: RankingEntry[];
  onSelectAthlete?: (athleteId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View>
      {entries.map((e) => {
        // External sources (e.g. PTO) use slug ids that don't resolve to our
        // athlete profiles / favorites — render those rows non-interactive.
        const internal = !e.athleteId.includes(':');
        const tappable = internal && !!onSelectAthlete;
        return (
          <View key={e.athleteId} style={[styles.row, { borderColor: theme.border }]}>
            {e.rank <= 3 ? (
              <View style={[styles.medal, { backgroundColor: MEDAL[e.rank - 1] }]}>
                <ThemedText style={styles.medalText}>{e.rank}</ThemedText>
              </View>
            ) : (
              <ThemedText style={[styles.rank, { color: theme.text }]}>{e.rank}</ThemedText>
            )}
            <Movement value={e.movement} />
            <Pressable
              style={styles.nameCol}
              disabled={!tappable}
              onPress={tappable ? () => onSelectAthlete?.(e.athleteId) : undefined}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {countryFlag(e.country)} {e.athleteName}
              </ThemedText>
            </Pressable>
            <ThemedText type="smallBold" style={styles.points}>
              {e.points.toLocaleString()}
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                {' '}
                {t('common.points')}
              </ThemedText>
            </ThemedText>
            {internal && <FavoriteButton kind="athlete" id={e.athleteId} size={18} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 22, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  medal: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  medalText: { fontSize: 12, fontWeight: '800', color: '#1A1A1A' },
  movement: { width: 26, flexDirection: 'row', alignItems: 'center', gap: 1 },
  nameCol: { flex: 1 },
  points: { fontVariant: ['tabular-nums'], textAlign: 'right' },
});
