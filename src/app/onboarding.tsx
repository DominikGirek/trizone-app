import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Wordmark } from '@/components/TopBar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fameScore } from '@/lib/athleteFame';
import { countryFlag, fold } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { bundledAthletes, getAthletes } from '@/services/athletes';
import type { Favorite, SeriesId } from '@/types';
import { useFavorites } from '@/store/favorites';
import { useSettings } from '@/store/settings';

const SERIES: SeriesId[] = ['wtcs', 'ironman', 'ironman703', 'challenge', 't100', 'pto'];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { addMany } = useFavorites();
  const { completeOnboarding } = useSettings();

  const [step, setStep] = useState(0);
  const [series, setSeries] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  // Full roster (curated + every generated pro) so onboarding search finds anyone; with no
  // query we show the best-known names first as suggestions.
  const { data: roster } = useQuery({
    queryKey: ['athletes'],
    queryFn: getAthletes,
    placeholderData: bundledAthletes(),
  });
  const filteredAthletes = useMemo(() => {
    const all = (roster ?? []).slice().sort((a, b) => fameScore(b) - fameScore(a));
    const q = fold(query.trim());
    if (!q) return all.slice(0, 30);
    return all.filter((a) => fold(a.name).includes(q)).slice(0, 40);
  }, [query, roster]);

  const reportAthlete = () => {
    haptics.light();
    router.push({ pathname: '/report', params: { type: 'athlete', prefill: query.trim() } });
  };

  const toggle = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    haptics.selection();
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setter(next);
  };

  const finish = () => {
    haptics.success();
    const favs: Favorite[] = [
      ...[...series].map((id) => ({ kind: 'series' as const, id })),
      ...[...picked].map((id) => ({ kind: 'athlete' as const, id })),
    ];
    if (favs.length) addMany(favs);
    completeOnboarding();
    router.replace('/');
  };

  const next = () => {
    haptics.light();
    if (step < 2) setStep(step + 1);
    else finish();
  };

  const progress = useMemo(() => [0, 1, 2], []);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.four }]}>
      <View style={styles.header}>
        <Wordmark size={26} />
        {step > 0 && (
          <Pressable onPress={finish} hitSlop={10}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('onboarding.skip')}
            </ThemedText>
          </Pressable>
        )}
      </View>

      <View style={styles.dots}>
        {progress.map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i <= step ? theme.primary : theme.backgroundSelected },
              i === step && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {step === 0 && (
        <View style={styles.welcome}>
          <View style={[styles.hero, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="trophy" size={64} color={theme.primary} />
          </View>
          <ThemedText style={styles.title}>{t('onboarding.welcomeTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('onboarding.welcomeSubtitle')}
          </ThemedText>
        </View>
      )}

      {step === 1 && (
        <ScrollView contentContainerStyle={styles.body}>
          <ThemedText style={styles.title}>{t('onboarding.pickSeriesTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('onboarding.pickSeriesSubtitle')}
          </ThemedText>
          <View style={styles.chipWrap}>
            {SERIES.map((s) => {
              const active = series.has(s);
              return (
                <Pressable
                  key={s}
                  onPress={() => toggle(series, s, setSeries)}
                  style={[
                    styles.bigChip,
                    {
                      backgroundColor: active ? theme.primary : theme.backgroundElement,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: active ? theme.onPrimary : theme.text }}>
                    {t(`series.${s}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {step === 2 && (
        <View style={styles.athleteStep}>
          <ThemedText style={[styles.title, styles.athleteTitle]}>{t('onboarding.pickAthletesTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('onboarding.pickAthletesSubtitle')}
          </ThemedText>

          <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('onboarding.searchAthletes')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.athleteList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            {filteredAthletes.map((a) => {
              const active = picked.has(a.id);
              return (
                <Pressable
                  key={a.id}
                  onPress={() => toggle(picked, a.id, setPicked)}
                  style={[
                    styles.athleteCard,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: active ? theme.primary : 'transparent',
                    },
                  ]}>
                  <ThemedText style={styles.flag}>{countryFlag(a.country)}</ThemedText>
                  <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
                    {a.name}
                  </ThemedText>
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={active ? theme.primary : theme.textSecondary}
                  />
                </Pressable>
              );
            })}

            {filteredAthletes.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.noResults}>
                {t('onboarding.noResults', { query: query.trim() })}
              </ThemedText>
            )}

            <Pressable
              onPress={reportAthlete}
              style={[styles.notFound, { borderColor: theme.border }]}>
              <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{t('onboarding.athleteNotFoundTitle')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('onboarding.athleteNotFoundHint')}
                </ThemedText>
              </View>
              <Ionicons name="mail-outline" size={18} color={theme.textSecondary} />
            </Pressable>
          </ScrollView>
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <Pressable onPress={next} style={[styles.cta, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 }}>
            {step === 0 ? t('onboarding.start') : step === 2 ? t('onboarding.finish') : t('onboarding.continue')}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: Spacing.one, marginTop: Spacing.four },
  dot: { height: 4, flex: 1, borderRadius: 999 },
  dotActive: { opacity: 1 },
  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  hero: {
    width: 140,
    height: 140,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  body: { paddingTop: Spacing.five, gap: Spacing.two, paddingBottom: Spacing.four },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { textAlign: 'center', lineHeight: 20, maxWidth: 340, alignSelf: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.four, justifyContent: 'center' },
  bigChip: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  athleteStep: { flex: 1, paddingTop: Spacing.five },
  athleteTitle: { marginBottom: Spacing.two },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.three,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  noResults: { textAlign: 'center', marginTop: Spacing.three },
  notFound: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.three,
  },
  athleteList: { gap: Spacing.two, marginTop: Spacing.three, paddingBottom: Spacing.four },
  athleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 2,
  },
  flag: { fontSize: 24 },
  footer: { paddingTop: Spacing.three },
  cta: {
    paddingVertical: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
  },
});
