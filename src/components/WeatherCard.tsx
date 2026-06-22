import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getRaceWeather, weatherIcon } from '@/services/weather';

export function WeatherCard({ lat, lon, date }: { lat: number; lon: number; date: string }) {
  const { t } = useTranslation();
  const theme = useTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['weather', lat, lon, date],
    queryFn: () => getRaceWeather(lat, lon, date),
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading || !data) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={weatherIcon(data.code) as any} size={34} color={theme.primary} />
      <View style={styles.temps}>
        <ThemedText style={styles.tempMax}>{data.tempMax}°</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          / {data.tempMin}°C
        </ThemedText>
      </View>
      <View style={styles.wind}>
        <Ionicons name="navigate-outline" size={14} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          {data.windMax} km/h
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {t('weather.title')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
  },
  temps: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.one },
  tempMax: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  wind: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { marginLeft: 'auto', textTransform: 'uppercase', letterSpacing: 0.5 },
});
