import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The group invite code, shown big + cleanly (generous lineHeight so the heavy glyphs never clip),
 * with an optional "Einladen" (share) button. Reused on the create-success step and the group screen.
 */
export function InviteCode({ code, onShare, style }: { code: string; onShare?: () => void; style?: any }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>
      <ThemedText type="small" themeColor="textSecondary">{t('group.inviteLabel')}</ThemedText>
      <ThemedText style={styles.code} numberOfLines={1} adjustsFontSizeToFit>
        {code}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        {t('group.inviteHint')}
      </ThemedText>
      {onShare && (
        <Pressable
          onPress={onShare}
          style={({ pressed }) => [styles.btn, { backgroundColor: theme.primary }, pressed && { opacity: 0.85 }]}>
          <Ionicons name="share-outline" size={18} color={theme.onPrimary} />
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>{t('group.invite')}</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.one },
  // fontSize 30 with lineHeight 46 (+ vertical padding) gives the bold, letter-spaced glyphs room so
  // they never get clipped top/bottom; adjustsFontSizeToFit keeps long codes on one line.
  code: {
    fontSize: 30,
    lineHeight: 46,
    paddingVertical: 2,
    fontWeight: '800',
    letterSpacing: 5,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  hint: { textAlign: 'center', lineHeight: 18, marginBottom: Spacing.two },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderRadius: 999,
  },
});
