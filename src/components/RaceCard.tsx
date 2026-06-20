import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { SeriesTag } from '@/components/SeriesTag';
import { StatusPill } from '@/components/StatusPill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { countryFlag, formatDate } from '@/lib/format';
import type { Race } from '@/types';

export function RaceCard({ race, onPress }: { race: Race; onPress: () => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.background, borderColor: theme.border },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={styles.dateCol}>
        <ThemedText style={[styles.day, { color: theme.text }]}>
          {new Date(race.date).getDate()}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.month}>
          {formatDate(race.date, lang).replace(/^\d+\.?\s*/, '')}
        </ThemedText>
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <SeriesTag series={race.series} />
          <StatusPill status={race.status} />
        </View>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
          {race.name}
        </ThemedText>
        <View style={styles.metaRow}>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {countryFlag(race.country)} {race.location} · {t(`format.${race.format}`)}
          </ThemedText>
        </View>
        {race.hasResults && (
          <View style={styles.resultsRow}>
            <Ionicons name="trophy-outline" size={13} color={theme.success} />
            <ThemedText type="small" style={{ color: theme.success, fontSize: 12 }}>
              {t('calendar.hasResults')}
            </ThemedText>
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dateCol: { alignItems: 'center', width: 44 },
  day: { fontSize: 24, fontWeight: '800', lineHeight: 26 },
  month: { fontSize: 11, textTransform: 'uppercase' },
  body: { flex: 1, gap: 3 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15 },
  metaRow: { flexDirection: 'row' },
  resultsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
});
