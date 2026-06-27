import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { timeAgo } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import type { HotAlert } from '@/lib/hotNews';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ICON: Record<HotAlert['category'], ComponentProps<typeof Ionicons>['name']> = {
  cancelled: 'close-circle',
  shortened: 'cut',
  postponed: 'calendar',
  delayed: 'time',
};

const UNDO_MS = 6000;

/**
 * In-app surface for a detected hot race-status change. Tap ✓ to mark it read: it collapses to a
 * slim "undo" strip with a ~6s draining bar — tap that to bring it back; after the grace period it
 * commits (onDismiss). The dismissal is scoped to this race+category, so an escalation re-surfaces.
 */
export function HotNewsBanner({
  alert,
  raceName,
  onPress,
  onDismiss,
}: {
  alert: HotAlert;
  raceName: string;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const loud = alert.severity !== 'minor';
  const tint = loud ? theme.primary : theme.textSecondary;

  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bar = useRef(new Animated.Value(1)).current;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const startDismiss = () => {
    haptics.light();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPending(true);
    bar.setValue(1);
    Animated.timing(bar, { toValue: 0, duration: UNDO_MS, useNativeDriver: false }).start();
    timer.current = setTimeout(onDismiss, UNDO_MS);
  };

  const undo = () => {
    haptics.light();
    if (timer.current) clearTimeout(timer.current);
    bar.stopAnimation();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPending(false);
  };

  if (pending) {
    return (
      <Pressable
        onPress={undo}
        accessibilityRole="button"
        style={({ pressed }) => [styles.strip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && { opacity: 0.85 }]}>
        <Ionicons name="checkmark-circle" size={17} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.stripText}>
          {t('hotNews.markedRead')}
        </ThemedText>
        <View style={{ flex: 1 }} />
        <Ionicons name="arrow-undo" size={14} color={theme.primary} />
        <ThemedText type="smallBold" style={{ color: theme.primary }}>
          {t('hotNews.undo')}
        </ThemedText>
        <Animated.View
          style={[styles.undoBar, { backgroundColor: tint, width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={[styles.accent, { backgroundColor: tint }]} />
      <View style={[styles.iconWrap, { backgroundColor: tint }]}>
        <Ionicons name={ICON[alert.category]} size={20} color={theme.onPrimary} />
      </View>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.body, pressed && { opacity: 0.6 }]}>
        <ThemedText type="small" style={[styles.eyebrow, { color: tint }]}>
          {t('hotNews.label').toUpperCase()} · {t(`hotNews.${alert.category}`).toUpperCase()}
        </ThemedText>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.race}>
          {raceName}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {alert.article.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.meta} numberOfLines={1}>
          {alert.article.source} · {timeAgo(alert.article.publishedAt, lang)}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={startDismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('hotNews.markRead')}
        style={({ pressed }) => [styles.check, { borderColor: theme.border }, pressed && { opacity: 0.6 }]}>
        <Ionicons name="checkmark" size={19} color={theme.textSecondary} />
      </Pressable>
    </View>
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
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  race: { fontSize: 15 },
  meta: { fontSize: 11, marginTop: 1 },
  check: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  stripText: { fontSize: 12 },
  undoBar: { position: 'absolute', left: 0, bottom: 0, height: 2.5 },
});
