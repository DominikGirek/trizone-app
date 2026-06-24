import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/FavoriteButton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { athleteTitle } from '@/lib/athleteTitle';
import { avatarColor, initials } from '@/lib/avatar';
import { countryFlag } from '@/lib/format';
import type { Athlete } from '@/types';

export function AthleteRow({ athlete, onPress }: { athlete: Athlete; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.border },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <View style={[styles.avatar, { backgroundColor: avatarColor(athlete.name) }]}>
        <ThemedText style={styles.avatarText}>{initials(athlete.name)}</ThemedText>
      </View>
      <View style={styles.body}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {athlete.name}
        </ThemedText>
        <ThemedText type="small" numberOfLines={1} style={[styles.title, { color: theme.primary }]}>
          {countryFlag(athlete.country)} {athleteTitle(athlete)}
        </ThemedText>
      </View>
      <FavoriteButton kind="athlete" id={athlete.id} size={20} />
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 12, fontWeight: '800' },
});
