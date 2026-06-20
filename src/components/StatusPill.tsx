import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, View } from 'react-native';

import { Pill } from '@/components/Pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Race } from '@/types';

function LivePill() {
  const { t } = useTranslation();
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.live, { backgroundColor: theme.primary }]}>
      <Animated.View style={[styles.dot, { backgroundColor: theme.onPrimary, opacity: pulse }]} />
      <ThemedText type="small" style={[styles.label, { color: theme.onPrimary }]}>
        {t('status.live')}
      </ThemedText>
    </View>
  );
}

export function StatusPill({ status }: { status: Race['status'] }) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (status === 'live') return <LivePill />;

  const cfg =
    status === 'finished'
      ? { color: theme.success, background: theme.backgroundElement }
      : { color: theme.textSecondary, background: theme.backgroundElement };

  return <Pill label={t(`status.${status}`)} color={cfg.color} background={cfg.background} />;
}

const styles = StyleSheet.create({
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dot: { width: 7, height: 7, borderRadius: 999 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
});
