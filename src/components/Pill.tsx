import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function Pill({
  label,
  color,
  background,
  dot,
}: {
  label: string;
  color: string;
  background: string;
  dot?: boolean;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      {dot && <View style={[styles.dot, { backgroundColor: color }]} />}
      <ThemedText type="small" style={[styles.label, { color }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
