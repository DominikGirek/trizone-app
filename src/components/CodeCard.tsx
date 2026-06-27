import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/Toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { codeAthleteName, codeEmoji, type DiscountCode } from '@/lib/discountCodes';
import { formatDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useCodeVotes } from '@/store/codeVotes';

/** A single discount-code card (copy + shop + 👍/👎). Shared by the Codes tab and athlete profiles. */
export function CodeCard({ code }: { code: DiscountCode }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const { show } = useToast();
  const { vote, voteOf } = useCodeVotes();
  const myVote = voteOf(code.id);
  // Community counts (server-fed once the backend aggregates votes) + this device's own vote,
  // so a 👍/👎 shows up immediately and sums with everyone else's later.
  const upCount = (code.thumbsUp ?? 0) + (myVote === 'up' ? 1 : 0);
  const downCount = (code.thumbsDown ?? 0) + (myVote === 'down' ? 1 : 0);
  const athlete = codeAthleteName(code);

  const daysLeft = code.validUntil ? Math.ceil((+new Date(code.validUntil) - Date.now()) / 86400000) : null;
  const soon = daysLeft != null && daysLeft <= 14;

  const onCopy = async () => {
    haptics.light();
    await Clipboard.setStringAsync(code.code);
    show(t('deals.copied'), 'checkmark-circle');
  };

  const onVote = (dir: 'up' | 'down') => {
    haptics.light();
    vote(code.id, dir);
    show(dir === 'up' ? t('deals.thanksUp') : t('deals.thanksDown'), dir === 'up' ? 'checkmark-circle' : 'flag');
  };

  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <View style={styles.cardTop}>
        <ThemedText style={styles.emoji}>{codeEmoji(code)}</ThemedText>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {code.brand}
          </ThemedText>
          <ThemedText style={[styles.deal, { color: theme.primary }]} numberOfLines={2}>
            {code.deal}
          </ThemedText>
          {!!athlete && (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ fontSize: 12 }}>
              🏃 {t('deals.via', { name: athlete })}
            </ThemedText>
          )}
        </View>
        {(soon || code.validUntil) && (
          <ThemedText type="small" style={{ color: soon ? theme.primary : theme.textSecondary, fontSize: 11 }}>
            {soon ? t('deals.endingSoon') : t('deals.validUntil', { date: formatDate(code.validUntil!, lang) })}
          </ThemedText>
        )}
      </View>

      {!!code.description && (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {code.description}
        </ThemedText>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={onCopy}
          style={({ pressed }) => [styles.codePill, { borderColor: theme.primary }, pressed && { opacity: 0.6 }]}>
          <ThemedText type="smallBold" style={{ color: theme.primary, letterSpacing: 1 }}>
            {code.code}
          </ThemedText>
          <Ionicons name="copy-outline" size={15} color={theme.primary} />
        </Pressable>
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(code.url)}
          style={({ pressed }) => [styles.shopBtn, { backgroundColor: theme.primary }, pressed && { opacity: 0.85 }]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            {t('deals.toShop')}
          </ThemedText>
          <Ionicons name="open-outline" size={15} color={theme.onPrimary} />
        </Pressable>
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.ad}>
          {t('deals.ad')}
          {code.checkedAt ? ` · ${t('deals.checkedAt', { date: formatDate(code.checkedAt, lang) })}` : ''}
        </ThemedText>
        <View style={styles.thumbs}>
          <Pressable onPress={() => onVote('up')} hitSlop={6} style={styles.thumbBtn}>
            <Ionicons
              name={myVote === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
              size={15}
              color={myVote === 'up' ? theme.primary : theme.textSecondary}
            />
            {upCount > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.thumbCount}>
                {upCount}
              </ThemedText>
            )}
          </Pressable>
          <Pressable onPress={() => onVote('down')} hitSlop={6} style={styles.thumbBtn}>
            <Ionicons
              name={myVote === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
              size={15}
              color={myVote === 'down' ? theme.primary : theme.textSecondary}
            />
            {downCount > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.thumbCount}>
                {downCount}
              </ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  emoji: { fontSize: 26 },
  deal: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  ad: { fontSize: 10, opacity: 0.7, flexShrink: 1 },
  thumbs: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumbBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  thumbCount: { fontSize: 11 },
});
