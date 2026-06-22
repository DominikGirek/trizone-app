import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { countryFlag, formatDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useMyRaces } from '@/store/myRaces';

export default function MyRacesScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { races, isMain, setMain, remove } = useMyRaces();

  const sorted = [...races].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const addRace = () => {
    router.back();
    router.push('/pick-race');
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, borderColor: theme.border }]}>
        <View style={{ width: 26 }} />
        <ThemedText style={styles.headerTitle}>{t('myRaces.title')}</ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState icon="flag-outline" message={t('myRaces.empty')} />
          <Pressable onPress={addRace} style={[styles.addBtn, { backgroundColor: theme.primary }]}>
            <Ionicons name="add" size={18} color={theme.onPrimary} />
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              {t('myRaces.add')}
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.five }}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t('myRaces.note')}
          </ThemedText>

          {sorted.map((r) => {
            const main = isMain(r.id);
            return (
              <View key={r.id} style={[styles.row, { borderColor: theme.border }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {r.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {countryFlag(r.country ?? 'DE')} {r.location} · {formatDate(r.date, lang)}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => {
                    haptics.light();
                    setMain(r.id);
                  }}
                  hitSlop={8}
                  accessibilityLabel={t('myRaces.main')}>
                  <Ionicons name={main ? 'trophy' : 'trophy-outline'} size={22} color={main ? theme.primary : theme.textSecondary} />
                </Pressable>
                <Pressable onPress={() => remove(r.id)} hitSlop={8} accessibilityLabel="remove">
                  <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
                </Pressable>
              </View>
            );
          })}

          <Pressable onPress={addRace} style={[styles.addRow, { borderColor: theme.border }]}>
            <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {t('myRaces.add')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      )}
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
  note: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    margin: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyWrap: { flex: 1, justifyContent: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three },
  addBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
});
