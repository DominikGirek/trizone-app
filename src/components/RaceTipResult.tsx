import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { avatarColor, initials } from '@/lib/avatar';
import { scoreTip, TIP_SIZE, type Gender } from '@/lib/tippspiel';
import { getAthletesByIds } from '@/services/athletes';
import type { VerifiedRaceResult } from '@/data/raceResults';
import { useTips } from '@/store/tips';

const GENDERS: Gender[] = ['men', 'women'];
const EXACT = '#1faa59';
const PARTIAL = '#E8A33D';

/**
 * Shown in the Tipp tab once a race has a VERIFIED result: the official top 5 per gender, each finisher
 * marked by how the user did (exact place / right athlete wrong place / missed), plus the scored total.
 * Uses the same pure scoring engine as the backend — what you see is what counts on the leaderboards.
 */
export function RaceTipResult({ raceId, result }: { raceId: string; result: VerifiedRaceResult }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { getTip } = useTips();
  const tip = getTip(raceId);
  const score = scoreTip(tip, { men: result.men, women: result.women });

  const ids = [...new Set([...result.men, ...result.women, ...tip.men, ...tip.women].filter(Boolean) as string[])];
  const { data: athletes = [] } = useQuery({
    queryKey: ['athletesByIds', ids.sort().join(',')],
    queryFn: () => getAthletesByIds(ids),
    enabled: ids.length > 0,
  });
  const nameById = new Map(athletes.map((a) => [a.id, a.name] as const));
  const nm = (id: string) => nameById.get(id) ?? id;

  const tipped = [...tip.men, ...tip.women].some(Boolean);

  return (
    <View style={styles.wrap}>
      <View style={[styles.scoreCard, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="trophy" size={22} color={theme.primary} />
        <View style={styles.flex}>
          <ThemedText type="smallBold">
            {tipped ? t('result.yourScore', { points: score.total }) : t('result.noTip')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {tipped ? t('result.breakdown', { men: score.men.points, women: score.women.points }) : t('result.noTipHint')}
          </ThemedText>
        </View>
      </View>

      {GENDERS.map((g) => {
        const actual = result[g].slice(0, TIP_SIZE);
        if (!actual.length) return null;
        const picks = tip[g];
        return (
          <View key={g} style={styles.section}>
            <View style={styles.genderHead}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.genderTitle}>
                {t(`tip.${g}`)}
              </ThemedText>
              {tipped && (
                <ThemedText type="small" themeColor="textSecondary">
                  {`${score[g].points} ${t('tippspiel.points')}`}
                </ThemedText>
              )}
            </View>
            {actual.map((aid, i) => {
              const exact = picks[i] === aid;
              const partial = !exact && picks.includes(aid);
              const color = exact ? EXACT : partial ? PARTIAL : theme.textSecondary;
              return (
                <View key={aid + i} style={[styles.row, { borderColor: theme.border }]}>
                  <ThemedText type="smallBold" style={styles.rank}>{i + 1}</ThemedText>
                  <View style={[styles.av, { backgroundColor: avatarColor(nm(aid)) }]}>
                    <ThemedText style={styles.avText}>{initials(nm(aid))}</ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>{nm(aid)}</ThemedText>
                  {(exact || partial) && (
                    <View style={[styles.badge, { backgroundColor: color }]}>
                      <Ionicons name={exact ? 'checkmark' : 'swap-vertical'} size={12} color="#fff" />
                      <ThemedText style={styles.badgeText}>
                        {exact ? `+3` : `+1`}
                      </ThemedText>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}

      <ThemedText type="small" themeColor="textSecondary" style={styles.source}>
        {t('result.source', { source: result.source })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.one },
  flex: { flex: 1 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: 14 },
  section: { marginTop: Spacing.three, gap: Spacing.one + 2 },
  genderHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  genderTitle: { letterSpacing: 0.3 },
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
  badge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: Spacing.one + 2, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  source: { marginTop: Spacing.three, lineHeight: 17 },
});
