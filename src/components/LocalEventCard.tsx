import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusPill } from '@/components/StatusPill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { countryFlag, formatDate, formatKm } from '@/lib/format';
import type { LocalEventWithDistance } from '@/services/localEvents';

export function LocalEventCard({
  event,
  onPress,
}: {
  event: LocalEventWithDistance;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { i18n } = useTranslation();
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
          {new Date(event.date).getDate()}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.month}>
          {formatDate(event.date, lang).replace(/^\d+\.?\s*/, '')}
        </ThemedText>
      </View>

      <View style={styles.body}>
        {!!event.series && (
          <ThemedText type="small" style={[styles.series, { color: theme.primary }]}>
            {event.series.toUpperCase()}
          </ThemedText>
        )}
        <View style={styles.topRow}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
            {event.name}
          </ThemedText>
          {event.status === 'live' && <StatusPill status="live" />}
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {countryFlag(event.country)} {event.town}
          </ThemedText>
          {event.distanceKm != null && (
            <View style={[styles.distBadge, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" style={{ color: theme.primary, fontSize: 11, fontWeight: '700' }}>
                {formatKm(event.distanceKm)}
              </ThemedText>
            </View>
          )}
        </View>
        <View style={styles.chips}>
          {event.distances.slice(0, 3).map((d) => (
            <ThemedText
              key={d.label}
              type="small"
              themeColor="textSecondary"
              style={[styles.chip, { borderColor: theme.border }]}>
              {d.label}
            </ThemedText>
          ))}
        </View>
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
  body: { flex: 1, gap: 4 },
  series: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  name: { fontSize: 15, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distBadge: { paddingHorizontal: Spacing.two, paddingVertical: 1, borderRadius: 999, marginLeft: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  chip: {
    fontSize: 11,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
