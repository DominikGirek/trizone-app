import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

const GOLD = '#E8A33D';

/**
 * Dashboard cue that a tipped race has been SCORED (Tobi published its result). Calm and gold — never red
 * (red is reserved for urgency) — it pulses once to draw the eye, then opens the full-screen reveal moment.
 * Rendered only when there's an unseen scored tip; tapping it marks the result seen, so it clears.
 */
export function ResultRevealCue({ raceId, raceName, points }: { raceId: string; raceName: string; points: number }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const scale = useSharedValue(1);

  useEffect(() => {
    // one gentle attention pulse, shortly after mount
    scale.value = withDelay(450, withSequence(withTiming(1.03, { duration: 220 }), withTiming(1, { duration: 240 })));
  }, [scale]);

  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const open = () => {
    haptics.light();
    router.push(`/reveal/${raceId}`);
  };

  return (
    <Animated.View entering={FadeInDown.duration(360)} style={[pulse, styles.wrap]}>
      <Pressable
        onPress={open}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: theme.backgroundElement, borderColor: GOLD },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: GOLD }]}>
          <Ionicons name="flag" size={18} color="#fff" />
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {t('dashboard.resultCueTitle', { race: raceName })}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {t('dashboard.resultCueSub', { points })}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  flex: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
