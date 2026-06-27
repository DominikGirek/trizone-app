import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReportNotFound } from '@/components/ReportNotFound';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BRANDS } from '@/lib/brands';
import { countryFlag } from '@/lib/format';
import { fameScore } from '@/lib/athleteFame';
import { haptics } from '@/lib/haptics';
import { bundledAthletes, getAthletes } from '@/services/athletes';
import { useFavorites } from '@/store/favorites';
import type { FavoriteKind, SeriesId } from '@/types';

const SERIES: SeriesId[] = ['wtcs', 'ironman', 'ironman703', 'challenge', 't100', 'pto'];
const SERIES_EMOJI: Record<string, string> = {
  wtcs: '🌍',
  ironman: '🔴',
  ironman703: '🔴',
  challenge: '🟡',
  t100: '💯',
  pto: '🏆',
  other: '🏁',
};

function Tile({
  emoji,
  label,
  active,
  onPress,
}: {
  emoji: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.backgroundElement, borderColor: active ? theme.primary : 'transparent' },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={styles.heart}>
        <Ionicons
          name={active ? 'heart' : 'add-circle-outline'}
          size={16}
          color={active ? theme.primary : theme.textSecondary}
        />
      </View>
      <ThemedText style={styles.tileEmoji}>{emoji}</ThemedText>
      <ThemedText type="small" numberOfLines={2} style={styles.tileLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function FollowingScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isFavorite, toggle, idsOf } = useFavorites();
  const athleteIds = idsOf('athlete');
  // Full roster (curated + every generated pro) so a followed athlete always resolves —
  // even one picked up only from a race start list. bundledAthletes() renders instantly.
  const { data: roster } = useQuery({
    queryKey: ['athletes'],
    queryFn: getAthletes,
    placeholderData: bundledAthletes(),
  });
  const all = roster ?? [];
  // Show followed athletes first, then top suggestions ranked by fame (best-known first).
  const followedAthletes = all.filter((a) => athleteIds.includes(a.id));
  const suggestions = all
    .filter((a) => !athleteIds.includes(a.id))
    .sort((a, b) => fameScore(b) - fameScore(a))
    .slice(0, Math.max(0, 21 - followedAthletes.length));
  const athleteTiles = [...followedAthletes, ...suggestions];

  const onToggle = (kind: FavoriteKind, id: string) => {
    haptics.light();
    toggle(kind, id);
  };
  const goSearch = () => {
    router.back();
    router.push('/search');
  };
  const seeAll = () => {
    router.back();
    router.push('/favorites');
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, borderColor: theme.border }]}>
        <View style={{ width: 26 }} />
        <ThemedText style={styles.headerTitle}>{t('following.title')}</ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {t('following.subtitle')}
        </ThemedText>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
          {t('following.series').toUpperCase()}
        </ThemedText>
        <View style={styles.grid}>
          {SERIES.map((id) => (
            <Tile
              key={id}
              emoji={SERIES_EMOJI[id]}
              label={t(`series.${id}`)}
              active={isFavorite('series', id)}
              onPress={() => onToggle('series', id)}
            />
          ))}
        </View>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
          {t('following.brands').toUpperCase()}
        </ThemedText>
        <View style={styles.grid}>
          {BRANDS.map((b) => (
            <Tile
              key={b.id}
              emoji={b.emoji}
              label={b.name}
              active={isFavorite('brand', b.id)}
              onPress={() => onToggle('brand', b.id)}
            />
          ))}
        </View>
        <ReportNotFound type="brand" />

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
          {t('following.athletes').toUpperCase()}
        </ThemedText>
        <View style={styles.grid}>
          {athleteTiles.map((a) => (
            <Tile
              key={a.id}
              emoji={countryFlag(a.country)}
              label={a.name}
              active={athleteIds.includes(a.id)}
              onPress={() => onToggle('athlete', a.id)}
            />
          ))}
          <Pressable
            onPress={goSearch}
            style={({ pressed }) => [styles.tile, styles.addTile, { borderColor: theme.border }, pressed && { opacity: 0.7 }]}>
            <Ionicons name="search" size={22} color={theme.primary} />
            <ThemedText type="small" numberOfLines={2} style={styles.tileLabel}>
              {t('following.addAthletes')}
            </ThemedText>
          </Pressable>
        </View>
        <ReportNotFound type="athlete" />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.two, borderColor: theme.border }]}>
        <Pressable onPress={seeAll} style={[styles.btn, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            {t('following.seeAll')}
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => router.back()} style={[styles.btn, styles.btnGhost, { borderColor: theme.border }]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('following.close')}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  content: { paddingBottom: Spacing.six },
  subtitle: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  section: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  tile: {
    width: '31%',
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: Spacing.two,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  addTile: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  heart: { position: 'absolute', top: 6, right: 6 },
  tileEmoji: { fontSize: 26 },
  tileLabel: { textAlign: 'center', fontSize: 12 },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
  btnGhost: { borderWidth: 1 },
});
