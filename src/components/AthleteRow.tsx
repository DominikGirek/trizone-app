import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/FavoriteButton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countryFlag } from '@/lib/format';
import type { Athlete } from '@/types';

export function AthleteRow({ athlete, onPress }: { athlete: Athlete; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.border },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={styles.flag}>{countryFlag(athlete.country)}</ThemedText>
      </View>
      <View style={styles.body}>
        <ThemedText type="smallBold">{athlete.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {t(`common.${athlete.gender}`)} ·{' '}
          {athlete.series.map((s) => t(`series.${s}`)).join(', ')}
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
  flag: { fontSize: 20 },
  body: { flex: 1, gap: 2 },
});
