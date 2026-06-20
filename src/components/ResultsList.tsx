import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countryFlag } from '@/lib/format';
import type { RaceResult } from '@/types';

function medalColor(position: number, theme: ReturnType<typeof useTheme>) {
  if (position === 1) return '#F5B301';
  if (position === 2) return '#9CA3AF';
  if (position === 3) return '#CD7F32';
  return theme.textSecondary;
}

export function ResultsList({
  results,
  onSelectAthlete,
}: {
  results: RaceResult[];
  onSelectAthlete: (athleteId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View>
      <View style={[styles.header, { borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.posCol}>
          {t('results.rank')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.nameCol}>
          {t('results.athlete')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.timeCol}>
          {t('results.time')}
        </ThemedText>
      </View>

      {results.map((r) => (
        <Pressable
          key={`${r.position}-${r.athleteId}`}
          onPress={() => onSelectAthlete(r.athleteId)}
          style={({ pressed }) => [
            styles.row,
            { borderColor: theme.border },
            pressed && { backgroundColor: theme.backgroundElement },
          ]}>
          <ThemedText
            style={[styles.posCol, styles.pos, { color: medalColor(r.position, theme) }]}>
            {r.position}
          </ThemedText>
          <View style={styles.nameCol}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {countryFlag(r.country)} {r.athleteName}
            </ThemedText>
            {r.splits && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.splits}>
                {[r.splits.swim, r.splits.bike, r.splits.run].filter(Boolean).join('  •  ')}
              </ThemedText>
            )}
          </View>
          <ThemedText type="smallBold" style={[styles.timeCol, styles.time]}>
            {r.dnf ? 'DNF' : r.totalTime}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
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
  pos: { fontSize: 17, fontWeight: '800' },
  nameCol: { flex: 1, gap: 2 },
  splits: { fontSize: 11 },
  timeCol: { width: 78, textAlign: 'right' },
  time: { fontVariant: ['tabular-nums'] },
});
