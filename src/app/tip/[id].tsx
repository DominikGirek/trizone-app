import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PrizeStrip } from '@/components/PrizeStrip';
import { RaceTipPicker } from '@/components/RaceTipPicker';
import { RaceTipResult } from '@/components/RaceTipResult';
import { EmptyState, LoadingState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getRaceResult } from '@/data/raceResults';
import { getPrize } from '@/data/tippspielPrizes';
import { countryFlag, formatDate } from '@/lib/format';
import type { AppLanguage } from '@/i18n';
import { getLocalEventById } from '@/services/localEvents';
import { getRaceStartList, raceKey } from '@/services/races';

/**
 * Focused "tip this race" screen — the direct door from the Tippspiel hub (no detour through the race
 * dashboard). Shows the verified result + your score if the race is done, the Top-5 picker if a start
 * list exists, or an honest "start list coming" state otherwise (never a dead end).
 */
export default function TipScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();

  const { data: vm, isLoading } = useQuery({
    queryKey: ['localEvent', id],
    queryFn: () => getLocalEventById(id),
    enabled: !!id,
  });

  const startKey = vm ? raceKey(vm.name, vm.date) : '';
  const { data: startList } = useQuery({
    queryKey: ['startlist', startKey],
    queryFn: () => getRaceStartList(startKey),
    enabled: !!startKey,
  });

  if (isLoading) return <LoadingState />;
  if (!vm) return <EmptyState message={t('local.empty')} />;

  const tipResult = getRaceResult(vm.id);
  const prize = getPrize(vm.id);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('raceTab.tip'), headerBackTitle: '' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle" style={styles.title} numberOfLines={2}>
          {vm.country ? `${countryFlag(vm.country)} ` : ''}
          {vm.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
          {vm.town ? `${vm.town} · ` : ''}
          {formatDate(vm.date, lang)}
        </ThemedText>

        {prize && <PrizeStrip prize={prize} style={{ marginHorizontal: Spacing.three, marginTop: Spacing.two }} />}

        {tipResult ? (
          <RaceTipResult raceId={vm.id} result={tipResult} />
        ) : startList ? (
          <RaceTipPicker
            raceId={vm.id}
            raceName={vm.name}
            raceDate={vm.date}
            raceKind="local"
            raceCountry={vm.country}
            entries={startList.entries}
          />
        ) : (
          <View style={[styles.soon, { borderColor: theme.border }]}>
            <Ionicons name="hourglass-outline" size={22} color={theme.textSecondary} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">{t('tip.noListTitle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{t('tip.noListHint')}</ThemedText>
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Spacing.five },
  flex: { flex: 1 },
  title: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  meta: { paddingHorizontal: Spacing.three, marginTop: 2 },
  soon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    margin: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
});
