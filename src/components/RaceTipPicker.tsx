import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { avatarColor, initials } from '@/lib/avatar';
import { haptics } from '@/lib/haptics';
import { isTipLocked, TIP_SIZE, type Gender } from '@/lib/tippspiel';
import type { StartListEntry } from '@/services/races';
import { useTips } from '@/store/tips';

type ActiveSlot = { gender: Gender; index: number } | null;
const GENDERS: Gender[] = ['men', 'women'];

/**
 * Pick the top 5 finishers per gender from the start list. One tip per race (local for now), auto-saved
 * on every change, locked at the race start. The basis for scoring + every leaderboard.
 */
export function RaceTipPicker({
  raceId,
  raceName,
  raceDate,
  raceKind,
  raceCountry,
  entries,
}: {
  raceId: string;
  raceName: string;
  raceDate: string;
  raceKind: 'pro' | 'local';
  raceCountry?: string;
  entries: StartListEntry[];
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { getTip, setPick } = useTips();
  const [active, setActive] = useState<ActiveSlot>(null);
  const meta = { name: raceName, date: raceDate, kind: raceKind, country: raceCountry };

  const locked = isTipLocked(raceDate);
  const tip = getTip(raceId);
  const nameById = new Map(entries.map((e) => [e.athlete.id, e.athlete.name] as const));

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <ThemedText type="smallBold" style={styles.title}>
          {t('tip.title')}
        </ThemedText>
        <ThemedText type="small" themeColor={locked ? 'textSecondary' : undefined} style={locked ? undefined : { color: theme.primary }}>
          {locked ? `🔒 ${t('tip.locked')}` : t('tip.openHint')}
        </ThemedText>
      </View>

      {GENDERS.map((g) => {
        const pool = entries.filter((e) => e.athlete.gender === g);
        if (!pool.length) return null;
        const picks = tip[g];
        const used = new Set(picks.filter(Boolean) as string[]);
        return (
          <View key={g} style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.genderTitle}>
              {t(`tip.${g}`)}
            </ThemedText>
            {Array.from({ length: TIP_SIZE }).map((_, i) => {
              const pid = picks[i];
              const open = active?.gender === g && active.index === i;
              return (
                <View key={i}>
                  <Pressable
                    onPress={() => {
                      if (locked) return;
                      haptics.light();
                      setActive(open ? null : { gender: g, index: i });
                    }}
                    style={({ pressed }) => [
                      styles.slot,
                      { borderColor: open ? theme.primary : theme.border },
                      pressed && !locked && { opacity: 0.7 },
                    ]}>
                    <View style={[styles.rank, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText type="smallBold">{i + 1}</ThemedText>
                    </View>
                    {pid ? (
                      <>
                        <View style={[styles.av, { backgroundColor: avatarColor(nameById.get(pid) ?? pid) }]}>
                          <ThemedText style={styles.avText}>{initials(nameById.get(pid) ?? '?')}</ThemedText>
                        </View>
                        <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
                          {nameById.get(pid) ?? pid}
                        </ThemedText>
                        {!locked && (
                          <Pressable onPress={() => setPick(raceId, g, i, null, meta)} hitSlop={10}>
                            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                          </Pressable>
                        )}
                      </>
                    ) : (
                      <>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                          {locked ? '—' : t('tip.pick')}
                        </ThemedText>
                        {!locked && (
                          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
                        )}
                      </>
                    )}
                  </Pressable>

                  {open && !locked && (
                    <ScrollView
                      style={[styles.chooser, { borderColor: theme.border, backgroundColor: theme.background }]}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled">
                      {pool.map((e) => {
                        const taken = used.has(e.athlete.id) && pid !== e.athlete.id;
                        return (
                          <Pressable
                            key={e.athlete.id}
                            disabled={taken}
                            onPress={() => {
                              haptics.light();
                              setPick(raceId, g, i, e.athlete.id, meta);
                              setActive(null);
                            }}
                            style={({ pressed }) => [styles.choice, taken && { opacity: 0.35 }, pressed && { backgroundColor: theme.backgroundElement }]}>
                            <View style={[styles.avSm, { backgroundColor: avatarColor(e.athlete.name) }]}>
                              <ThemedText style={styles.avSmText}>{initials(e.athlete.name)}</ThemedText>
                            </View>
                            <ThemedText type="small" numberOfLines={1} style={styles.flex}>
                              {e.athlete.name}
                            </ThemedText>
                            {taken && <Ionicons name="checkmark" size={16} color={theme.textSecondary} />}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.one },
  head: { marginBottom: Spacing.two },
  title: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  section: { marginTop: Spacing.three, gap: Spacing.one + 2 },
  genderTitle: { letterSpacing: 0.3, marginBottom: 2 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  av: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  chooser: {
    maxHeight: 260,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  choice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  avSm: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avSmText: { fontSize: 10, fontWeight: '800', color: '#fff' },
});
