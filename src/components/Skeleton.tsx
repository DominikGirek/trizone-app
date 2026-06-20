import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function Box({ style }: { style?: ViewStyle }) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[{ backgroundColor: theme.backgroundElement, opacity }, style]} />;
}

function NewsRowSkeleton() {
  return (
    <View style={styles.newsRow}>
      <Box style={styles.thumb} />
      <View style={styles.newsBody}>
        <Box style={styles.lineLg} />
        <Box style={styles.lineLg} />
        <Box style={styles.lineSm} />
      </View>
    </View>
  );
}

function ListRowSkeleton() {
  return (
    <View style={styles.listRow}>
      <Box style={styles.square} />
      <View style={styles.newsBody}>
        <Box style={styles.lineLg} />
        <Box style={styles.lineSm} />
      </View>
    </View>
  );
}

export function NewsListSkeleton() {
  return (
    <View>
      {Array.from({ length: 6 }).map((_, i) => (
        <NewsRowSkeleton key={i} />
      ))}
    </View>
  );
}

export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  newsRow: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three },
  listRow: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three, alignItems: 'center' },
  thumb: { width: 96, height: 96, borderRadius: 10 },
  square: { width: 44, height: 44, borderRadius: 8 },
  newsBody: { flex: 1, justifyContent: 'center', gap: Spacing.two },
  lineLg: { height: 12, borderRadius: 6, width: '92%' },
  lineSm: { height: 10, borderRadius: 5, width: '50%' },
});
