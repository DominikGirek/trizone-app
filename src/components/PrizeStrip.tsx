import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TipPrize } from '@/data/tippspielPrizes';

/** A small "what you can win" strip. Renders only when a real prize is configured for this scope. */
export function PrizeStrip({ prize, style }: { prize: TipPrize; style?: any }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const tappable = !!prize.url;

  const body = (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }, style]}>
      <Ionicons name="gift-outline" size={20} color={theme.primary} />
      <View style={styles.flex}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {t('prize.win')}: {prize.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {prize.sponsor ? t('prize.by', { sponsor: prize.sponsor }) : ''}
          {prize.sponsor && prize.detail ? ' · ' : ''}
          {prize.detail ?? ''}
        </ThemedText>
      </View>
      {tappable && <Ionicons name="open-outline" size={16} color={theme.textSecondary} />}
    </View>
  );

  if (!tappable) return body;
  return (
    <Pressable onPress={() => WebBrowser.openBrowserAsync(prize.url!)} style={({ pressed }) => pressed && { opacity: 0.8 }}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
  },
  flex: { flex: 1 },
});
