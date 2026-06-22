import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type Kind = 'race' | 'athlete' | 'brand' | 'general';

/** Dashed "X not found? Report it" row → opens the in-app report form. */
export function ReportNotFound({ type, prefill }: { type: Kind; prefill?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const titleKey = `report.row${type.charAt(0).toUpperCase() + type.slice(1)}Title`;

  const open = () => {
    haptics.light();
    router.push({
      pathname: '/report',
      params: type === 'general' ? { prefill: prefill ?? '' } : { type, prefill: prefill ?? '' },
    });
  };

  return (
    <Pressable onPress={open} style={[styles.row, { borderColor: theme.border }]}>
      <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
      <View style={{ flex: 1 }}>
        <ThemedText type="smallBold">{t(titleKey)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('report.rowHint')}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
