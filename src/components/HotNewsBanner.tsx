import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { timeAgo } from '@/lib/format';
import type { HotAlert } from '@/lib/hotNews';

const ICON: Record<HotAlert['category'], ComponentProps<typeof Ionicons>['name']> = {
  cancelled: 'close-circle',
  shortened: 'cut',
  postponed: 'calendar',
  delayed: 'time',
};

/**
 * In-app surface for a detected hot race-status change — a preview of what would later be
 * pushed. Critical/major read in the brand red; minor stays muted.
 */
export function HotNewsBanner({
  alert,
  raceName,
  onPress,
}: {
  alert: HotAlert;
  raceName: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const loud = alert.severity !== 'minor';
  const tint = loud ? theme.primary : theme.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && { opacity: 0.85 },
      ]}>
      <View style={[styles.accent, { backgroundColor: tint }]} />
      <View style={[styles.iconWrap, { backgroundColor: tint }]}>
        <Ionicons name={ICON[alert.category]} size={20} color={theme.onPrimary} />
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <ThemedText type="small" style={[styles.eyebrow, { color: tint }]}>
            {t('hotNews.label').toUpperCase()} · {t(`hotNews.${alert.category}`).toUpperCase()}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.race}>
          {raceName}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {alert.article.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.meta} numberOfLines={1}>
          {alert.article.source} · {timeAgo(alert.article.publishedAt, lang)}
        </ThemedText>
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
    paddingLeft: Spacing.three + 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  race: { fontSize: 15 },
  meta: { fontSize: 11, marginTop: 1 },
});
