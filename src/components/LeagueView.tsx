import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';

import { ListSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { getAllLeagues, leaguesMatchingTeam, type LeagueEntry } from '@/services/leagues';

const GROUP_ORDER = [
  '1. Bundesliga',
  '2. Bundesliga',
  'Regionalliga',
  'Landesliga',
  'Nordrhein-Westfalen',
  'Bayern',
  'Baden-Württemberg',
  'Hessen',
  'Weitere',
];

const STATE_ABBR: Record<string, string> = {
  'Nordrhein-Westfalen': 'NRW',
  Bayern: 'BY',
  'Baden-Württemberg': 'BW',
  Hessen: 'HE',
  Niedersachsen: 'NDS',
  'Rheinland-Pfalz': 'RLP',
  Berlin: 'BE',
  Brandenburg: 'BB',
  Sachsen: 'SN',
};

// Tier "crest": a colour-coded division badge — the league analogue of the athlete avatar.
function crest(group: string): { label: string; bg: string | null } {
  if (/^1\./.test(group)) return { label: '1.', bg: '#E2483C' };
  if (/^2\./.test(group)) return { label: '2.', bg: '#2F6FB0' };
  if (/Regionalliga/i.test(group)) return { label: 'RL', bg: '#C77D2E' };
  if (/Landesliga/i.test(group)) return { label: 'LL', bg: '#3E8E5A' };
  return { label: STATE_ABBR[group] ?? 'LV', bg: null }; // null → neutral surface
}

const genderOf = (name: string): 'women' | 'men' | null =>
  /\bfrauen\b/i.test(name) ? 'women' : /\bm[äa]nner\b/i.test(name) ? 'men' : null;

function LeagueRow({ item, matchedTeam }: { item: LeagueEntry; matchedTeam?: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const c = crest(item.group);
  const g = genderOf(item.name);

  const onPress = () => {
    haptics.light();
    if (item.live && item.divisionGuid) router.push(`/league/${item.divisionGuid}`);
    else if (item.url) WebBrowser.openBrowserAsync(item.url);
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={[styles.crest, { backgroundColor: c.bg ?? theme.background }]}>
        <ThemedText style={[styles.crestText, { color: c.bg ? '#fff' : theme.textSecondary }]}>
          {c.label}
        </ThemedText>
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          {g && <Ionicons name={g === 'women' ? 'female' : 'male'} size={12} color={theme.textSecondary} />}
          <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
            {item.name}
          </ThemedText>
        </View>
        {matchedTeam ? (
          <ThemedText type="small" numberOfLines={1} style={{ color: theme.primary, fontSize: 11, marginTop: 1 }}>
            {t('league.teamMatch', { team: matchedTeam })}
          </ThemedText>
        ) : item.live ? (
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: theme.success }]} />
            <ThemedText type="small" style={{ color: theme.success, fontSize: 11 }}>
              {t('league.live')}
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: 1 }}>
            {t('league.external')}
          </ThemedText>
        )}
      </View>
      <Ionicons name={item.live ? 'chevron-forward' : 'open-outline'} size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

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

export function LeagueView() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState<'all' | 'women' | 'men'>('all');

  const { data: leagues, isLoading } = useQuery({ queryKey: ['allLeagues'], queryFn: getAllLeagues });

  const teamMatches = useMemo(() => leaguesMatchingTeam(query), [query]);
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (leagues ?? []).filter((l) => {
      if (gender !== 'all' && genderOf(l.name) !== gender) return false;
      return !q || l.name.toLowerCase().includes(q) || (!!l.divisionGuid && teamMatches.has(l.divisionGuid));
    });
    const byGroup = new Map<string, LeagueEntry[]>();
    for (const l of filtered) {
      if (!byGroup.has(l.group)) byGroup.set(l.group, []);
      byGroup.get(l.group)!.push(l);
    }
    return [...byGroup.entries()]
      .sort((a, b) => {
        const ia = GROUP_ORDER.indexOf(a[0]);
        const ib = GROUP_ORDER.indexOf(b[0]);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
      .map(([title, data]) => ({ title, data }));
  }, [leagues, query, teamMatches, gender]);

  if (isLoading) return <ListSkeleton count={10} />;

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <View style={[styles.inputWrap, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('league.searchPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
        <View style={styles.chipRow}>
          <Chip label={t('league.allGenders')} active={gender === 'all'} onPress={() => setGender('all')} />
          <Chip label={`♀ ${t('common.women')}`} active={gender === 'women'} onPress={() => setGender('women')} />
          <Chip label={`♂ ${t('common.men')}`} active={gender === 'men'} onPress={() => setGender('men')} />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              {section.title.toUpperCase()}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
              {section.data.length}
            </ThemedText>
          </View>
        )}
        renderItem={({ item }) => (
          <LeagueRow item={item} matchedTeam={item.divisionGuid ? teamMatches.get(item.divisionGuid) : undefined} />
        )}
        ListEmptyComponent={<EmptyState icon="search-outline" message={t('search.empty')} />}
        ListFooterComponent={
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t('league.coverageNote')}
          </ThemedText>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: 12,
  },
  input: { flex: 1, fontSize: 16, padding: 0 },
  chipRow: { flexDirection: 'row', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: 999 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three + 2,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one + 2,
  },
  sectionTitle: { letterSpacing: 0.5 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    padding: Spacing.two + 2,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  crest: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  crestText: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  body: { flex: 1, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  note: { padding: Spacing.three, textAlign: 'center', lineHeight: 16 },
});
