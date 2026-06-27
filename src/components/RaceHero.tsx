import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Countdown } from '@/components/Countdown';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type HeroChip = { label: string; live?: boolean; solid?: boolean };

/**
 * The shared cinematic race hero (Dashboard + Race Center → one look, no drift).
 * `variant`: 'live' = bright red gradient (urgency); 'dark' = deep dark-maroon gradient otherwise.
 * White text/glyph sit on the gradient regardless of light/dark theme (it's a self-contained banner).
 */
export function RaceHero({
  variant,
  chips,
  eyebrow,
  title,
  strikethrough,
  meta,
  countdownDate,
  distances,
  glyph = 'walk',
  footer,
  onPress,
  right,
  titleLines = 3,
  style,
}: {
  variant: 'live' | 'dark';
  chips?: HeroChip[];
  eyebrow?: string;
  title: string;
  strikethrough?: boolean;
  meta?: string;
  countdownDate?: string;
  distances?: { swim?: number | null; bike?: number | null; run?: number | null } | null;
  glyph?: React.ComponentProps<typeof Ionicons>['name'];
  footer?: string;
  onPress?: () => void;
  right?: ReactNode;
  titleLines?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const colors =
    variant === 'live' ? (['#FF483D', '#8d140d'] as const) : (['#3a1417', '#160a0b', '#0B0B0C'] as const);

  const body = (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, style]}>
      <Ionicons name={glyph} size={150} color="rgba(255,255,255,0.10)" style={styles.glyph} />
      {(chips?.length || right) && (
        <View style={styles.top}>
          <View style={styles.chips}>
            {chips?.map((c, i) => (
              <View key={i} style={[styles.chip, c.solid && { backgroundColor: '#fff' }]}>
                {c.live && <View style={styles.dot} />}
                <ThemedText type="small" style={[styles.chipText, c.solid && { color: theme.primary }]}>
                  {c.label}
                </ThemedText>
              </View>
            ))}
          </View>
          {right}
        </View>
      )}
      {!!eyebrow && (
        <ThemedText type="small" style={styles.eyebrow}>
          {eyebrow}
        </ThemedText>
      )}
      <ThemedText style={[styles.title, strikethrough && styles.struck]} numberOfLines={titleLines}>
        {title}
      </ThemedText>
      {!!meta && (
        <ThemedText type="small" style={styles.meta}>
          {meta}
        </ThemedText>
      )}
      {!!countdownDate && (
        <View style={styles.countdown}>
          <Countdown date={countdownDate} color="#fff" />
        </View>
      )}
      {distances && (
        <View style={styles.band}>
          {distances.swim != null && <ThemedText type="small" style={styles.bandText}>🏊 {distances.swim} km</ThemedText>}
          {distances.bike != null && <ThemedText type="small" style={styles.bandText}>🚴 {distances.bike} km</ThemedText>}
          {distances.run != null && <ThemedText type="small" style={styles.bandText}>🏃 {distances.run} km</ThemedText>}
        </View>
      )}
      {!!footer && (
        <ThemedText type="small" style={[styles.meta, { marginTop: 4 }]}>
          {footer}
        </ThemedText>
      )}
    </LinearGradient>
  );

  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.9 } : null)}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  hero: { padding: Spacing.four, borderRadius: 20, overflow: 'hidden' },
  glyph: { position: 'absolute', right: -14, bottom: -18 },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', flex: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#fff' },
  eyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 2 },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.4, color: '#fff' },
  struck: { textDecorationLine: 'line-through', opacity: 0.7 },
  meta: { color: 'rgba(255,255,255,0.82)' },
  countdown: { marginTop: Spacing.three },
  band: { flexDirection: 'row', gap: 16, marginTop: Spacing.three },
  bandText: { color: 'rgba(255,255,255,0.9)' },
});
