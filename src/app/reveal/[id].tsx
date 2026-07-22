import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { avatarColor, initials } from '@/lib/avatar';
import { scoreTip, TIP_SIZE, type Gender } from '@/lib/tippspiel';
import { getAthletesByIds } from '@/services/athletes';
import { fetchMyGlobalRank } from '@/services/tippspielSync';
import { getRaceResult } from '@/data/raceResults';
import { useTips } from '@/store/tips';

const GENDERS: Gender[] = ['men', 'women'];
const GOLD = '#E8A33D';
const GREEN = '#1faa59';
const ROW_BASE = 520; // ms — rows start landing after the score has begun counting
const ROW_STEP = 95;

/** A number that eases up from 0 to `target` once, after `delay`. Cheap (one value, ~1s, easeOutCubic). */
function useCountUp(target: number, duration = 900, delay = 340): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setVal(0);
      return;
    }
    let raf = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min(1, (ts - start) / duration);
        setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return val;
}

export default function RevealScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const raceId = String(id ?? '');
  const { getTip, markResultSeen } = useTips();

  const result = getRaceResult(raceId);
  const tip = getTip(raceId);
  const score = result ? scoreTip(tip, result) : null;
  const tipped = [...tip.men, ...tip.women].some(Boolean);

  // Mark seen as soon as it's opened → the dashboard cue clears. No-ops if already seen.
  const marked = useRef(false);
  useEffect(() => {
    if (result && !marked.current) {
      marked.current = true;
      markResultSeen(raceId);
    }
  }, [raceId, result, markResultSeen]);

  const ids = useMemo(
    () =>
      result
        ? [...new Set([...result.men, ...result.women, ...tip.men, ...tip.women].filter(Boolean) as string[])]
        : [],
    [result, tip],
  );
  const { data: athletes = [] } = useQuery({
    queryKey: ['athletesByIds', ids.sort().join(',')],
    queryFn: () => getAthletesByIds(ids),
    enabled: ids.length > 0,
  });
  const nameById = new Map(athletes.map((a) => [a.id, a.name] as const));
  const nm = (aid: string) => nameById.get(aid) ?? aid;

  const { data: rank } = useQuery({
    queryKey: ['myGlobalRank', raceId],
    queryFn: fetchMyGlobalRank,
    staleTime: 60_000,
  });

  // Flat, ordered finisher rows (men then women) with each pick's outcome — drives stagger + haptics.
  const rows = useMemo(() => {
    if (!result) return [] as { g: Gender; aid: string; i: number; hit: 'exact' | 'partial' | 'miss' }[];
    const out: { g: Gender; aid: string; i: number; hit: 'exact' | 'partial' | 'miss' }[] = [];
    for (const g of GENDERS) {
      result[g].slice(0, TIP_SIZE).forEach((aid, i) => {
        const picks = tip[g];
        const exact = picks[i] === aid;
        const partial = !exact && picks.includes(aid);
        out.push({ g, aid, i, hit: exact ? 'exact' : partial ? 'partial' : 'miss' });
      });
    }
    return out;
  }, [result, tip]);

  const total = score?.total ?? 0;
  const count = useCountUp(total);

  // Haptic tick on each hit as it lands + a success buzz at the end. Native only.
  useEffect(() => {
    if (Platform.OS === 'web' || !rows.length) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    rows.forEach((r, idx) => {
      if (r.hit === 'miss') return;
      timers.push(
        setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), ROW_BASE + idx * ROW_STEP),
      );
    });
    if (total > 0) {
      timers.push(
        setTimeout(
          () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
          ROW_BASE + rows.length * ROW_STEP + 260,
        ),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [rows, total]);

  const reaction = !tipped
    ? t('reveal.reactNoTip')
    : total >= 30
      ? t('reveal.reactHuge')
      : total >= 15
        ? t('reveal.reactStrong')
        : total >= 5
          ? t('reveal.reactOk')
          : total > 0
            ? t('reveal.reactLow')
            : t('reveal.reactNone');

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  if (!result) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('reveal.notScored')}
        </ThemedText>
        <Pressable onPress={close} style={[styles.doneBtn, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{t('reveal.done')}</ThemedText>
        </Pressable>
      </View>
    );
  }

  const rowOf = (g: Gender, i: number) => rows.findIndex((r) => r.g === g && r.i === i);
  const numberColor = total > 0 ? GOLD : theme.textSecondary;

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable onPress={close} hitSlop={12} style={[styles.close, { top: insets.top + Spacing.two }]}>
        <Ionicons name="close" size={26} color={theme.textSecondary} />
      </Pressable>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.six },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: race + the big scored total counting up */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.hero}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
            {(tip.name ?? raceId).toUpperCase()} · {t('reveal.scored')}
          </ThemedText>
          <View style={styles.trophyRow}>
            <Ionicons name="trophy" size={26} color={numberColor} />
          </View>
          <ThemedText style={[styles.big, { color: numberColor }]}>{count}</ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {tipped ? t('reveal.pointsBreakdown', { men: score!.men.points, women: score!.women.points }) : t('reveal.noTipHint')}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.reaction}>
            {reaction}
          </ThemedText>
          {rank && (
            <Animated.View
              entering={FadeInDown.delay(ROW_BASE + rows.length * ROW_STEP).duration(420)}
              style={[styles.rankPill, { backgroundColor: theme.backgroundElement }]}
            >
              <Ionicons name="podium-outline" size={15} color={GOLD} />
              <ThemedText type="smallBold">{t('reveal.globalRank', { rank: rank.rank, total: rank.total })}</ThemedText>
            </Animated.View>
          )}
        </Animated.View>

        {/* Per-gender: the official top 5, each marked by how the pick did, landing one by one */}
        {GENDERS.map((g) => {
          const actual = result[g].slice(0, TIP_SIZE);
          if (!actual.length) return null;
          return (
            <View key={g} style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.genderTitle}>
                {t(`tip.${g}`)}
                {tipped ? `  ·  ${score![g].points} ${t('tippspiel.points')}` : ''}
              </ThemedText>
              {actual.map((aid, i) => {
                const r = rows[rowOf(g, i)];
                const exact = r?.hit === 'exact';
                const partial = r?.hit === 'partial';
                const color = exact ? GREEN : partial ? GOLD : theme.textSecondary;
                return (
                  <Animated.View
                    key={aid + i}
                    entering={FadeInDown.delay(ROW_BASE + rowOf(g, i) * ROW_STEP).duration(380)}
                    style={[styles.row, { borderColor: theme.border }]}
                  >
                    <ThemedText type="smallBold" style={styles.rank}>
                      {i + 1}
                    </ThemedText>
                    <View style={[styles.av, { backgroundColor: avatarColor(nm(aid)) }]}>
                      <ThemedText style={styles.avText}>{initials(nm(aid))}</ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
                      {nm(aid)}
                    </ThemedText>
                    {(exact || partial) && (
                      <View style={[styles.badge, { backgroundColor: color }]}>
                        <Ionicons name={exact ? 'checkmark' : 'swap-vertical'} size={12} color="#fff" />
                        <ThemedText style={styles.badgeText}>{exact ? '+3' : '+1'}</ThemedText>
                      </View>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          );
        })}

        <ThemedText type="small" themeColor="textSecondary" style={styles.source}>
          {t('result.source', { source: result.source })}
        </ThemedText>

        <Pressable onPress={close} style={[styles.doneBtn, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{t('reveal.done')}</ThemedText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  close: { position: 'absolute', right: Spacing.three, zIndex: 10, padding: Spacing.one },
  hero: { alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.two },
  kicker: { letterSpacing: 0.5, textAlign: 'center' },
  trophyRow: { marginTop: Spacing.two },
  big: { fontSize: 76, lineHeight: 82, fontWeight: '800' },
  reaction: { textAlign: 'center', marginTop: Spacing.one },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    marginTop: Spacing.two,
  },
  section: { marginTop: Spacing.three, gap: Spacing.one + 2 },
  genderTitle: { letterSpacing: 0.3, marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 22, textAlign: 'center' },
  av: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  source: { marginTop: Spacing.three, lineHeight: 17, textAlign: 'center' },
  doneBtn: {
    marginTop: Spacing.four,
    alignSelf: 'center',
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.two + 2,
    borderRadius: 999,
  },
});
