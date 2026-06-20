import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countdownTo } from '@/lib/format';

/**
 * Re-renders the subtree once per second so the countdown ticks live, and
 * re-syncs immediately whenever the app/tab regains focus — otherwise a
 * backgrounded web tab (where the OS throttles/pauses timers) would appear
 * frozen until the user reloads.
 */
function useTick(intervalMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const id = setInterval(bump, intervalMs);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') bump();
    });
    let onVisible: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      onVisible = () => {
        if (!document.hidden) bump();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
    }
    return () => {
      clearInterval(id);
      sub.remove();
      if (onVisible) {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', onVisible);
      }
    };
  }, [intervalMs]);
}

function Unit({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <View style={styles.unit}>
      <ThemedText style={[styles.value, color ? { color } : null]}>
        {String(value).padStart(2, '0')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={[styles.unitLabel, color ? { color, opacity: 0.85 } : null]}>
        {label}
      </ThemedText>
    </View>
  );
}

/** `color` renders the countdown on a colored background (e.g. onPrimary on a red hero). */
export function Countdown({ date, color }: { date: string; color?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  useTick(1000);
  const { days, hours, minutes, seconds, past } = countdownTo(date);

  if (past) {
    return (
      <ThemedText type="smallBold" style={{ color: color ?? theme.primary }}>
        {t('countdown.soon')}
      </ThemedText>
    );
  }

  const sepColor = color ? { color, opacity: 0.6 } : { color: theme.textSecondary };
  return (
    <View style={styles.row}>
      <Unit value={days} label={t('countdown.days')} color={color} />
      <ThemedText style={[styles.sep, sepColor]}>:</ThemedText>
      <Unit value={hours} label={t('countdown.hours')} color={color} />
      <ThemedText style={[styles.sep, sepColor]}>:</ThemedText>
      <Unit value={minutes} label={t('countdown.minutes')} color={color} />
      <ThemedText style={[styles.sep, sepColor]}>:</ThemedText>
      <Unit value={seconds} label={t('countdown.seconds')} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  unit: { alignItems: 'center', minWidth: 44 },
  value: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  unitLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  sep: { fontSize: 24, fontWeight: '700', marginBottom: 14 },
});
