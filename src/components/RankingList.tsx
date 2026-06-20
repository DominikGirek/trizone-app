import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/FavoriteButton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countryFlag } from '@/lib/format';
import type { RankingEntry } from '@/types';

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
            <ThemedText style={[styles.rank, { color: theme.text }]}>{e.rank}</ThemedText>
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
  rank: { width: 22, fontSize: 16, fontWeight: '800' },
  movement: { width: 26, flexDirection: 'row', alignItems: 'center', gap: 1 },
  nameCol: { flex: 1 },
  points: { fontVariant: ['tabular-nums'], textAlign: 'right' },
});
