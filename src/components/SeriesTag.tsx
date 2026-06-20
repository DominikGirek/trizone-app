import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { SeriesId } from '@/types';

export function SeriesTag({ series }: { series: SeriesId }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <ThemedText
      type="small"
      style={{ color: theme.primary, fontWeight: '800', fontSize: 11, letterSpacing: 0.3 }}>
      {t(`series.${series}`)}
    </ThemedText>
  );
}
