import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Wordmark({ size = 22 }: { size?: number }) {
  const theme = useTheme();
  return (
    <ThemedText style={{ fontSize: size, fontWeight: '900', letterSpacing: -0.5 }}>
      Tri<ThemedText style={{ fontSize: size, fontWeight: '900', color: theme.primary }}>Zone</ThemedText>
    </ThemedText>
  );
}

export function TopBar({
  title,
  right,
  showSearch = true,
}: {
  title: string;
  right?: ReactNode;
  showSearch?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.two, backgroundColor: theme.background, borderColor: theme.border },
      ]}>
      <View style={styles.brandRow}>
        <Wordmark />
        <View style={styles.actions}>
          {right}
          {showSearch && (
            <Pressable onPress={() => router.push('/search')} hitSlop={10} accessibilityRole="button">
              <Ionicons name="search" size={22} color={theme.text} />
            </Pressable>
          )}
        </View>
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
