import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBar } from '@/components/TopBar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { useSettings, type ThemePref } from '@/store/settings';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.cardWrap}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardTitle}>
        {title.toUpperCase()}
      </ThemedText>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>{children}</View>
    </View>
  );
}

function NavRow({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.6 }]}>
        <Ionicons name={icon} size={20} color={theme.text} />
        <ThemedText type="default" style={styles.navLabel}>
          {label}
        </ThemedText>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </Pressable>
    </Link>
  );
}

export default function MoreScreen() {
  const { t } = useTranslation();
  const { language, setLanguage, themePref, setThemePref } = useSettings();

  return (
    <ThemedView style={styles.container}>
      <TopBar title={t('more.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card title={t('more.discover')}>
          <NavRow href="/deals" icon="pricetags-outline" label={t('tabs.deals')} />
        </Card>

        <Card title={t('more.language')}>
          <SegmentedControl<AppLanguage>
            value={language}
            onChange={setLanguage}
            segments={[
              { value: 'de', label: 'Deutsch' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Card>

        <Card title={t('more.theme')}>
          <SegmentedControl<ThemePref>
            value={themePref}
            onChange={setThemePref}
            segments={[
              { value: 'system', label: t('more.themeSystem') },
              { value: 'light', label: t('more.themeLight') },
              { value: 'dark', label: t('more.themeDark') },
            ]}
          />
        </Card>

        <Card title={t('more.about')}>
          <ThemedText type="small" style={styles.aboutText}>
            {t('more.aboutText')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.dataNote}>
            {t('more.dataSource')}
          </ThemedText>
        </Card>

        <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
          TriZone · {t('more.version')} {Constants.expoConfig?.version ?? '1.0.0'}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four },
  cardWrap: { gap: Spacing.two },
  cardTitle: { letterSpacing: 0.5, paddingHorizontal: Spacing.one },
  card: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  navLabel: { flex: 1, fontWeight: '600' },
  aboutText: { lineHeight: 20 },
  dataNote: { lineHeight: 18 },
  version: { textAlign: 'center', marginTop: Spacing.three },
});
