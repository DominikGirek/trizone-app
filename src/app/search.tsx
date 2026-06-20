import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FavoriteButton } from '@/components/FavoriteButton';
import { SeriesTag } from '@/components/SeriesTag';
import { EmptyState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countryFlag } from '@/lib/format';
import { athletes } from '@/mocks/athletes';
import { races } from '@/mocks/events';

export default function SearchScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const { foundAthletes, foundRaces } = useMemo(() => {
    if (!q) return { foundAthletes: [], foundRaces: [] };
    return {
      foundAthletes: athletes.filter((a) => a.name.toLowerCase().includes(q)),
      foundRaces: races.filter(
        (r) => r.name.toLowerCase().includes(q) || r.location.toLowerCase().includes(q),
      ),
    };
  }, [q]);

  const hasResults = foundAthletes.length > 0 || foundRaces.length > 0;

  const go = (path: string) => {
    if (router.canGoBack()) router.back();
    router.push(path);
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.searchRow}>
        <View style={[styles.inputWrap, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={theme.textSecondary}
            autoFocus
            returnKeyType="search"
            style={[styles.input, { color: theme.text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
      </View>

      {!q ? (
        <EmptyState icon="search-outline" message={t('search.prompt')} />
      ) : !hasResults ? (
        <EmptyState icon="sad-outline" message={t('search.empty')} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          {foundAthletes.length > 0 && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
                {t('search.athletes').toUpperCase()}
              </ThemedText>
              {foundAthletes.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => go(`/athlete/${a.id}`)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: theme.border },
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <ThemedText style={styles.flag}>{countryFlag(a.country)}</ThemedText>
                  <ThemedText type="smallBold" style={{ flex: 1 }}>
                    {a.name}
                  </ThemedText>
                  <FavoriteButton kind="athlete" id={a.id} size={20} />
                </Pressable>
              ))}
            </>
          )}

          {foundRaces.length > 0 && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
                {t('search.races').toUpperCase()}
              </ThemedText>
              {foundRaces.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => go(`/event/${r.id}`)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: theme.border },
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {r.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {countryFlag(r.country)} {r.location}
                    </ThemedText>
                  </View>
                  <SeriesTag series={r.series} />
                </Pressable>
              ))}
            </>
          )}
          <View style={{ height: insets.bottom + Spacing.five }} />
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: 12,
  },
  input: { flex: 1, fontSize: 16, padding: 0 },
  section: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flag: { fontSize: 22 },
});
