import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const MARK = require('../../assets/images/logo-mark.png');

/** The TriZone brand mark (white double-chevron) on the red app-icon tile. */
export function LogoTile({ size = 32 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.logoTile,
        { width: size, height: size, borderRadius: size * 0.3, backgroundColor: theme.primary },
      ]}>
      <Image source={MARK} style={{ width: size * 0.58, height: size * 0.58 }} contentFit="contain" />
    </View>
  );
}

export function Wordmark({ size = 20 }: { size?: number }) {
  const theme = useTheme();
  return (
    <ThemedText style={{ fontSize: size, fontWeight: '900', letterSpacing: -0.5 }}>
      Tri<ThemedText style={{ fontSize: size, fontWeight: '900', color: theme.primary }}>Zone</ThemedText>
    </ThemedText>
  );
}

/** Brand lockup: the app-icon tile + the wordmark. */
export function BrandLockup() {
  return (
    <View style={styles.lockup}>
      <LogoTile size={34} />
      <Wordmark size={22} />
    </View>
  );
}

/** Account avatar — a circle with the user's initials (falls back to a glyph until login). */
export function HeaderAvatar({
  onPress,
  initials,
  label,
  badge,
}: {
  onPress: () => void;
  initials?: string;
  label?: string;
  badge?: number;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.avatar, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.7 }]}>
      {initials ? (
        <ThemedText style={[styles.avatarText, { color: theme.text }]}>{initials}</ThemedText>
      ) : (
        <Ionicons name="person" size={18} color={theme.text} />
      )}
      {!!badge && badge > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
          <ThemedText style={[styles.badgeText, { color: theme.onPrimary }]}>{badge}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

/** Circular header action — a subtle chip so the icons read as intentional buttons. */
export function HeaderIconButton({
  icon,
  onPress,
  label,
  badge,
}: {
  icon: IoniconName;
  onPress: () => void;
  label?: string;
  badge?: number;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconBtn,
        { backgroundColor: theme.backgroundElement },
        pressed && { opacity: 0.6 },
      ]}>
      <Ionicons name={icon} size={19} color={theme.text} />
      {!!badge && badge > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
          <ThemedText style={[styles.badgeText, { color: theme.onPrimary }]}>{badge}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

export function TopBar({
  title,
  eyebrow,
  right,
  showSearch = true,
}: {
  /** Optional — omit both title and eyebrow for a pure brand bar (logo + actions). */
  title?: string;
  /** Small contextual line above the title (e.g. the date on the home screen). */
  eyebrow?: string;
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
        <BrandLockup />
        <View style={styles.actions}>
          {right}
          {showSearch && (
            <HeaderIconButton icon="search" onPress={() => router.push('/search')} label="Suche" />
          )}
        </View>
      </View>
      {!!eyebrow && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
          {eyebrow}
        </ThemedText>
      )}
      {!!title && <ThemedText style={styles.title}>{title}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logoTile: { alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  eyebrow: { fontSize: 12, marginTop: Spacing.three, textTransform: 'capitalize' },
  title: {
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 1,
  },
});
