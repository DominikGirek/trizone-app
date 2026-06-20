import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/Toast';
import { TopBar } from '@/components/TopBar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import {
  activeCodes,
  codeAthleteName,
  codeEmoji,
  CODE_CATEGORIES,
  type CodeCategory,
  type DiscountCode,
} from '@/lib/discountCodes';
import { formatDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useCodeVotes } from '@/store/codeVotes';
import { useFavorites } from '@/store/favorites';

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? theme.primary : theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={{ color: active ? theme.onPrimary : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function CodeCard({ code }: { code: DiscountCode }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const { show } = useToast();
  const { vote, voteOf } = useCodeVotes();
  const myVote = voteOf(code.id);
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
            {(code.thumbsUp ?? 0) > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.thumbCount}>
                {code.thumbsUp}
              </ThemedText>
            )}
          </Pressable>
          <Pressable onPress={() => onVote('down')} hitSlop={6} style={styles.thumbBtn}>
            <Ionicons
              name={myVote === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
              size={15}
              color={myVote === 'down' ? theme.primary : theme.textSecondary}
            />
            {(code.thumbsDown ?? 0) > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.thumbCount}>
                {code.thumbsDown}
              </ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function DealsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { idsOf } = useFavorites();
  const { downvoted } = useCodeVotes();
  const followedAthletes = idsOf('athlete');
  const followedBrands = idsOf('brand');
  const [cat, setCat] = useState<CodeCategory | null>(null);
  const [q, setQ] = useState('');

  const { mineAthletes, mineBrands, rest } = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = activeCodes()
      .filter((c) => !downvoted.includes(c.id))
      .filter((c) => (cat ? c.category === cat : true))
      .filter((c) => {
        if (!query) return true;
        const hay = `${c.brand} ${c.code} ${c.deal} ${c.description ?? ''} ${codeAthleteName(c) ?? ''}`.toLowerCase();
        return hay.includes(query);
      })
      .sort(
        (a, b) =>
          (a.validUntil ? +new Date(a.validUntil) : Infinity) - (b.validUntil ? +new Date(b.validUntil) : Infinity),
      );
    const isMyAthlete = (c: DiscountCode) => !!c.athleteId && followedAthletes.includes(c.athleteId);
    const isMyBrand = (c: DiscountCode) => !isMyAthlete(c) && !!c.brandId && followedBrands.includes(c.brandId);
    return {
      mineAthletes: base.filter(isMyAthlete),
      mineBrands: base.filter(isMyBrand),
      rest: base.filter((c) => !isMyAthlete(c) && !isMyBrand(c)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, q, downvoted.join('|'), followedAthletes.join('|'), followedBrands.join('|')]);

  const personalized = mineAthletes.length > 0 || mineBrands.length > 0;
  const Section = ({ title, codes }: { title: string; codes: DiscountCode[] }) =>
    codes.length === 0 ? null : (
      <>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
          {title.toUpperCase()}
        </ThemedText>
        {codes.map((c) => (
          <CodeCard key={c.id} code={c} />
        ))}
      </>
    );

  return (
    <ThemedView style={styles.container}>
      <TopBar title={t('deals.title')} />

      <View style={styles.searchWrap}>
        <View style={[styles.inputBox, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={17} color={theme.textSecondary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('deals.search')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text }]}
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.catRow}>
        <Chip label={t('deals.allCategories')} active={cat == null} onPress={() => setCat(null)} />
        {CODE_CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            label={`${c.emoji} ${t(`deals.cat.${c.id}`)}`}
            active={cat === c.id}
            onPress={() => setCat(cat === c.id ? null : c.id)}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
          {t('deals.disclaimer')}
        </ThemedText>

        <Section title={t('deals.yourAthletes')} codes={mineAthletes} />
        <Section title={t('deals.yourBrands')} codes={mineBrands} />
        <Section title={personalized ? t('deals.all') : t('deals.allCodes')} codes={rest} />

        {mineAthletes.length === 0 && mineBrands.length === 0 && rest.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            {t('deals.empty')}
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 42,
    borderRadius: 12,
  },
  input: { flex: 1, fontSize: 15, padding: 0 },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: 999 },
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  content: { paddingBottom: Spacing.six },
  disclaimer: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.one, fontSize: 11 },
  section: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    letterSpacing: 0.5,
  },
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
  empty: { padding: Spacing.five, textAlign: 'center' },
});
